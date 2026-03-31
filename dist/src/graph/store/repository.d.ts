import { StoredGraph, CreateGraphInput, UpdateGraphStatusInput, StoreQuery, GraphStatus } from './types';
export declare class GraphRepository {
    constructor();
    private init;
    save(input: CreateGraphInput): Promise<StoredGraph>;
    findById(id: string): Promise<StoredGraph | null>;
    updateStatus(input: UpdateGraphStatusInput): Promise<StoredGraph>;
    updatePromptEmbedding(id: string, embedding: Buffer): Promise<StoredGraph>;
    incrementUsage(id: string): Promise<void>;
    query(params: StoreQuery): Promise<StoredGraph[]>;
    stats(): Promise<{
        total: number;
        byStatus: Record<GraphStatus, number>;
    }>;
    private toStoredGraph;
}
//# sourceMappingURL=repository.d.ts.map