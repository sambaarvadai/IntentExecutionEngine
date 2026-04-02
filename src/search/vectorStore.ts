import { ChromaClient } from 'chromadb';
import { EmbeddingResult, SimilarityMatch } from './types';
import { APIDefinition } from '../context/types';

const COLLECTION_NAME = 'api_definitions';

export class ChromaVectorStore {
  private client: ChromaClient;
  private collection: any = null;

  constructor(chromaUrl: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: chromaUrl });
  }

  async init(): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: 'API definitions for semantic search',
        'hnsw:space': 'cosine'
      }
    });
    console.log('[CHROMA] Collection ready:', COLLECTION_NAME);
  }

  private ensureInit(): any {
    if (!this.collection) {
      throw new Error('ChromaVectorStore not initialized. Call init() first.');
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
        planId: (api as any).planId ?? apiId,
        description: api.description ?? '',
        status: api.status,
        indexedAt: Date.now()
      }],
      documents: [embedding.text]
    });
    console.log('[CHROMA] Upserted:', apiId);
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

    if (!results.ids?.[0]?.length) return [];

    return results.ids[0].map((id: string, i: number) => ({
      apiId: id,
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
