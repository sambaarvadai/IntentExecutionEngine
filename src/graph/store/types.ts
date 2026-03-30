// ------------------------------------------------------------------
// Graph Store Types
// ------------------------------------------------------------------

import { ExecutionGraph } from '../types';

export type GraphStatus = 'draft' | 'approved' | 'rejected' | 'deprecated';

export interface StoredGraph {
  id: string;
  prompt: string;
  graphJson: string;           // ExecutionGraph serialized as JSON string
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
}

export interface CreateGraphInput {
  prompt: string;
  graph: ExecutionGraph;       // import from graph/types
  generationMs: number;
  executionMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface UpdateGraphStatusInput {
  id: string;
  status: GraphStatus;
  approvedBy?: string;
  approvalNote?: string;
}

export interface StoreQuery {
  status?: GraphStatus;
  limit?: number;
  offset?: number;
  promptContains?: string;     // basic text search
}
