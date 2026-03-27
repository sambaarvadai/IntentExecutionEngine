// ------------------------------------------------------------------
// Graph Execution Types
// ------------------------------------------------------------------

import { QueryPlan } from '../plans/types';
import { RequestContext } from '../context/types';

// ------------------------------------------------------------------
// Core Node Types
// ------------------------------------------------------------------

export type ExecutionNodeType = 'query' | 'transform' | 'condition' | 'notify';

export interface ExecutionNode {
  id: string;
  type: ExecutionNodeType;
  label: string;
  
  // Node-specific configuration
  plan?: QueryPlan;                        // for query nodes
  transform?: (input: any) => any;         // for transform nodes
  condition?: (input: any) => boolean | string;     // for condition nodes
  notify?: (input: any) => any;              // for notify nodes
  trueBranch?: string;                     // node id for condition true path
  falseBranch?: string;                    // node id for condition false path
  
  // Dependency management
  dependsOn?: string[];                    // explicit dependency override
  
  // Performance control
  timeoutMs?: number;                      // overrides GraphRuntimeOptions.timeoutMs
}

// ------------------------------------------------------------------
// Edge Types
// ------------------------------------------------------------------

export interface ExecutionEdge {
  from: string;
  to: string;
  label?: string;
  dataKey?: string;    // key to use when passing this edge's data to target node
                        // e.g. 'customers' so merge node gets input.customers
}

// ------------------------------------------------------------------
// Graph Definition
// ------------------------------------------------------------------

export interface ExecutionGraph {
  id: string;
  label: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  entryNode: string;    // id of node to start from
  
  // Optional context for execution
  requestContext?: RequestContext;
}

// ------------------------------------------------------------------
// Execution Results
// ------------------------------------------------------------------

export interface NodeResult {
  nodeId: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  skipped?: boolean;    // true if condition branching bypassed this node
}

export interface GraphResult {
  graphId: string;
  success: boolean;
  nodeResults: Map<string, NodeResult>;
  finalOutput: any;
  totalExecutionTime: number;
  failedNode?: string;   // id of node that caused failure if any
}

// ------------------------------------------------------------------
// Runtime Configuration
// ------------------------------------------------------------------

export interface GraphRuntimeOptions {
  maxParallelNodes?: number;    // default 5
  timeoutMs?: number;           // per-node timeout, default 30000
  stopOnFirstError?: boolean;   // default true
  dryRun?: boolean;             // validate graph without executing
}

// ------------------------------------------------------------------
// Helper Types
// ------------------------------------------------------------------

export type NodeInput = Record<string, any>;  // merged inputs from all incoming edges
export type NodeOutput = any;                 // what a node produces

// ------------------------------------------------------------------
// Validation Types
// ------------------------------------------------------------------

export interface GraphValidationError {
  nodeId?: string;
  edgeId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface GraphValidationResult {
  valid: boolean;
  errors: GraphValidationError[];
  warnings: GraphValidationError[];
}
