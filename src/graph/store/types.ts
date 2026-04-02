// ------------------------------------------------------------------
// Graph Store Types
// ------------------------------------------------------------------

import { ExecutionGraph } from '../types';

export type GraphStatus = 'draft' | 'approved' | 'rejected' | 'deprecated';

export interface StoredGraph {
  id: string;
  prompt: string;
  graphJson: string;           // ExecutionGraph serialized as JSON string
  intentJson?: string;         // QueryIntent serialized as JSON string
  status: GraphStatus;
  createdAt: number;           // unix timestamp ms
  updatedAt: number;
  generationMs: number;
  executionMs: number;
  executionCount: number;      // increments each time graph is reused
  lastUsedAt: number | null;
  approvedBy: string | null;   // user ID of reviewer
  approvalNote: string | null;   // reviewer comment
  nodeCount: number;           // denormalized for quick stats
  success: boolean;            // did the last execution succeed
  errorMessage: string | null; // if success is false
  promptEmbedding: Buffer | null; // Optional embedding vector as binary data
}

export interface CreateGraphInput {
  prompt: string;
  graph: ExecutionGraph;       // import from graph/types
  intent?: any;                // QueryIntent object (optional)
  generationMs: number;
  executionMs: number;
  success: boolean;
  errorMessage?: string;
  promptEmbedding?: Buffer;    // Optional embedding vector
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
  promptContains?: string;     // basic text search
}
