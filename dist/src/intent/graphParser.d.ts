import { ExecutionGraph, ExecutionNode } from '../graph/types';
import { NodeFactorySpec, PredicateSpec } from './types';
export declare class IntentParseError extends Error {
    details: unknown;
    rawText?: string | undefined;
    constructor(message: string, details: unknown, rawText?: string | undefined);
}
export declare function resolveNotifyNode(spec: NodeFactorySpec): ExecutionNode;
export declare function parseIntentGraph(raw: unknown): ExecutionGraph;
export declare function resolveTransformNode(spec: NodeFactorySpec): ExecutionNode;
export declare function resolveConditionNode(spec: NodeFactorySpec): ExecutionNode;
export declare function buildPredicate(spec: PredicateSpec): (row: any) => boolean;
//# sourceMappingURL=graphParser.d.ts.map