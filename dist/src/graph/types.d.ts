import { QueryPlan } from '../plans/types';
import { RequestContext } from '../context/types';
export type ExecutionNodeType = 'query' | 'transform' | 'condition' | 'notify';
export interface ExecutionNode {
    id: string;
    type: ExecutionNodeType;
    label: string;
    plan?: QueryPlan;
    transform?: (input: any) => any;
    condition?: (input: any) => boolean | string;
    notify?: (input: any) => any;
    trueBranch?: string;
    falseBranch?: string;
    dependsOn?: string[];
    timeoutMs?: number;
}
export interface ExecutionEdge {
    from: string;
    to: string;
    label?: string;
    dataKey?: string;
}
export interface ExecutionGraph {
    id: string;
    label: string;
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    entryNode: string;
    requestContext?: RequestContext;
}
export interface NodeResult {
    nodeId: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    skipped?: boolean;
}
export interface GraphResult {
    graphId: string;
    success: boolean;
    nodeResults: Map<string, NodeResult>;
    finalOutput: any;
    totalExecutionTime: number;
    failedNode?: string;
}
export interface GraphRuntimeOptions {
    maxParallelNodes?: number;
    timeoutMs?: number;
    stopOnFirstError?: boolean;
    dryRun?: boolean;
}
export type NodeInput = Record<string, any>;
export type NodeOutput = any;
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
//# sourceMappingURL=types.d.ts.map