import { EmbeddingResult } from './types';
import { APIDefinition } from '../context/types';
export declare class ChromaVectorStore {
    private client;
    private collection;
    constructor(chromaUrl?: string);
    init(): Promise<void>;
    private ensureInit;
    upsert(apiId: string, embedding: EmbeddingResult, api: APIDefinition): Promise<void>;
    search(queryEmbedding: number[], topK?: number): Promise<Array<{
        apiId: string;
        score: number;
        metadata: any;
    }>>;
    delete(apiId: string): Promise<void>;
    count(): Promise<number>;
}
//# sourceMappingURL=vectorStore.d.ts.map