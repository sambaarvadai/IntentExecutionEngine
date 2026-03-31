import { ExecutionGraph } from '../types';
export type GraphStatus = 'draft' | 'approved' | 'rejected' | 'deprecated';
export interface StoredGraph {
    id: string;
    prompt: string;
    graphJson: string;
    status: GraphStatus;
    createdAt: number;
    updatedAt: number;
    generationMs: number;
    executionMs: number;
    executionCount: number;
    lastUsedAt: number | null;
    approvedBy: string | null;
    approvalNote: string | null;
    nodeCount: number;
    success: boolean;
    errorMessage: string | null;
    promptEmbedding: Buffer | null;
}
export interface CreateGraphInput {
    prompt: string;
    graph: ExecutionGraph;
    generationMs: number;
    executionMs: number;
    success: boolean;
    errorMessage?: string;
    promptEmbedding?: Buffer;
}
export interface UpdateGraphStatusInput {
    id: string;
    status: GraphStatus;
    approvedBy?: string;
    approvalNote?: string;
}
export interface UpdatePromptEmbeddingInput {
    id: string;
    embedding: Buffer;
}
export interface StoreQuery {
    status?: GraphStatus;
    limit?: number;
    offset?: number;
    promptContains?: string;
}
//# sourceMappingURL=types.d.ts.map