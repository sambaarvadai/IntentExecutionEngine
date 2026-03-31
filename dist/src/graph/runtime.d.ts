import { ExecutionGraph, GraphResult, GraphRuntimeOptions, GraphValidationResult } from './types';
export declare class GraphRuntime {
    execute(graph: ExecutionGraph, options?: GraphRuntimeOptions): Promise<GraphResult>;
    validateGraph(graph: ExecutionGraph): Promise<GraphValidationResult>;
    private topologicalSort;
    private executeNodes;
    private executeNode;
    private executeQueryNode;
    private executeTransformNode;
    private executeConditionNode;
    private executeNotifyNode;
    private collectNodeInputs;
    private markSubgraphSkipped;
    private groupByDependencyLevel;
    private chunkArray;
    private withTimeout;
    private mergeOptions;
    private buildResult;
    private findFinalOutput;
}
export declare function validateGraph(graph: ExecutionGraph): Promise<GraphValidationResult>;
//# sourceMappingURL=runtime.d.ts.map