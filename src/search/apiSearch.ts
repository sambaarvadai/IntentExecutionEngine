import { VoyageEmbeddings } from './embeddings';
import { ChromaVectorStore } from './vectorStore';
import { 
  CacheCheckResult, 
  SearchResult, 
  SIMILARITY_THRESHOLD 
} from './types';
import { APIDefinition } from '../context/types';
import { apiRegistry } from '../api';

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

    // Search for similar APIs
    const results = await this.vectorStore.search(
      queryEmbedding.embedding,
      5   // top 5 candidates
    );

    // Filter to hits above threshold
    const hit = results.find(r => r.score >= SIMILARITY_THRESHOLD);

    if (!hit) {
      return { hit: false, searchTimeMs: Date.now() - start };
    }

    // Load the full API from registry
    const api = await apiRegistry.get(hit.apiId).catch(() => null);
    
    // Verify it's still ACTIVE (may have been deprecated since indexing)
    if (!api || api.status !== 'ACTIVE') {
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
    const parts = [
      api.label,
      api.description ?? '',
      ...((api as any).generatingPrompts ?? [])
    ].filter(Boolean);
    return parts.join('. ');
  }
}
