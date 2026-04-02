import { VoyageEmbeddings } from './embeddings';
import { ChromaVectorStore } from './vectorStore';
import { 
  CacheCheckResult, 
  SearchResult, 
  SIMILARITY_THRESHOLD 
} from './types';
import { APIDefinition } from '../context/types';
import { apiRegistry } from '../api/registry';
import { graphRepository } from '../graph/store';

export class APISearchService {
  constructor(
    private embeddings: VoyageEmbeddings,
    private vectorStore: ChromaVectorStore
  ) {}

  async init(): Promise<void> {
    await this.vectorStore.init();
  }

  // Called when a new ACTIVE API is registered —
  // indexes it so future prompts can find it
  async indexAPI(api: APIDefinition): Promise<void> {
    // Embed the text that best describes what this API does
    // Use description + label + generating prompts for richer matching
    const textToEmbed = this.buildIndexText(api);
    const embedding = await this.embeddings.embedDocument(textToEmbed);
    await this.vectorStore.upsert(api.id, embedding, api);
  }

  // Called before LLM generation — check if similar API exists
  async checkCache(prompt: string): Promise<CacheCheckResult> {
    const start = Date.now();

    // Embed the incoming prompt
    const queryEmbedding = await this.embeddings.embed(prompt);
    console.log('[CACHE] Query embedding shape:', queryEmbedding.embedding.length);

    // Search for similar APIs
    const results = await this.vectorStore.search(
      queryEmbedding.embedding,
      5   // top 5 candidates
    );
    
    console.log('[CACHE] Search results:', JSON.stringify(results, null, 2));

    // Filter to hits above threshold
    const hit = results.find(r => r.score >= SIMILARITY_THRESHOLD);
    console.log('[CACHE] Threshold:', SIMILARITY_THRESHOLD, 'Best score:', results[0]?.score);

    if (!hit) {
      return { hit: false, searchTimeMs: Date.now() - start };
    }

    // Try registry first (fast, in-memory)
    let api = await apiRegistry.get(hit.apiId).catch(() => null);
    
    // Registry miss — look up from graph store using metadata
    if (!api) {
      // ChromaDB metadata has the route and label stored
      // Reconstruct minimal API definition from metadata + graph store
      const graphId = hit.metadata?.planId ?? hit.apiId;
      const storedGraph = await graphRepository.findById(graphId)
                           .catch(() => null);
      
      if (!storedGraph || storedGraph.status !== 'approved') {
        return { hit: false, searchTimeMs: Date.now() - start };
      }

      // Rebuild API definition from stored graph
      api = {
        id: hit.apiId,
        route: hit.metadata?.route ?? `/api/query/${graphId}`,
        method: 'POST',
        planId: graphId,
        label: hit.metadata?.label ?? storedGraph.prompt,
        status: 'ACTIVE',
        createdAt: new Date(storedGraph.createdAt),
        updatedAt: new Date(storedGraph.updatedAt),
        executionGraph: JSON.parse(storedGraph.graphJson)
      };
      
      // Re-register in memory so next hit is instant
      try {
        await apiRegistry.register(api);
      } catch { /* already registered */ }
    }

    if (!api) {
      return { hit: false, searchTimeMs: Date.now() - start };
    }

    return {
      hit: true,
      match: { apiId: hit.apiId, score: hit.score, api },
      searchTimeMs: Date.now() - start
    };
  }

  // Remove from index when API is deprecated or rejected
  async removeFromIndex(apiId: string): Promise<void> {
    await this.vectorStore.delete(apiId);
  }

  private buildIndexText(api: APIDefinition): string {
    const prompts = (api as any).generatingPrompts ?? [];
    if (prompts.length > 0) return prompts.join('. ');
    return api.label ?? '';
  }
}
