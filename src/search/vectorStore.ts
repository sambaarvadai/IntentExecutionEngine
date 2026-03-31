import { ChromaClient, Collection } from 'chromadb';
import { EmbeddingResult, SimilarityMatch } from './types';
import { APIDefinition } from '../context/types';

const COLLECTION_NAME = 'api_definitions';

export class ChromaVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(chromaUrl: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: chromaUrl });
  }

  async init(): Promise<void> {
    // Get or create the collection
    this.collection = await this.client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: 'API definitions for semantic search',
        'hnsw:space': 'cosine'    // use cosine similarity
      }
    });
  }

  private ensureInit(): Collection {
    if (!this.collection) {
      throw new Error(
        'ChromaVectorStore not initialized. Call init() first.'
      );
    }
    return this.collection;
  }

  async upsert(
    apiId: string,
    embedding: EmbeddingResult,
    api: APIDefinition
  ): Promise<void> {
    const collection = this.ensureInit();
    await collection.upsert({
      ids: [apiId],
      embeddings: [embedding.embedding],
      metadatas: [{
        apiId,
        route: api.route,
        label: api.label,
        description: api.description ?? '',
        status: api.status,
        nodeCount: (api as any).executionGraph?.nodes?.length ?? 0,
        indexedAt: Date.now()
      }],
      documents: [embedding.text]   // original text for inspection
    });
  }

  async search(
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<Array<{ apiId: string; score: number; metadata: any }>> {
    const collection = this.ensureInit();
    
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      include: ['metadatas', 'distances', 'documents']
    });

    if (!results.ids[0]) return [];

    return results.ids[0].map((id, i) => ({
      apiId: id,
      // ChromaDB returns distances — convert to similarity score
      // For cosine: similarity = 1 - distance
      score: 1 - (results.distances?.[0]?.[i] ?? 1),
      metadata: results.metadatas?.[0]?.[i] ?? {}
    }));
  }

  async delete(apiId: string): Promise<void> {
    const collection = this.ensureInit();
    await collection.delete({ ids: [apiId] });
  }

  async count(): Promise<number> {
    const collection = this.ensureInit();
    return collection.count();
  }
}
