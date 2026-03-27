import { RequestContext } from '../context/types';
import { ExecutionGraph, GraphResult } from '../graph/types';
export interface IntentRequest {
    prompt: string;
    context?: RequestContext;
    options?: {
        maxNodes?: number;
        allowParallel?: boolean;
        dryRun?: boolean;
    };
}
export interface IntentResult {
    graph: ExecutionGraph;
    result: GraphResult;
    generationMs: number;
    executionMs: number;
    prompt: string;
}
export interface IntentParseResult {
    graph: ExecutionGraph;
    confidence: number;
    reasoning?: string;
}
export interface NodeFactorySpec {
    id: string;
    type: 'transform' | 'condition' | 'notify';
    factory: string;
    params: Record<string, unknown>;
}
export interface EqualsPredicate {
    op: 'equals';
    field: string;
    value: unknown;
}
export interface GreaterThanPredicate {
    op: 'greaterThan';
    field: string;
    value: unknown;
}
export interface LessThanPredicate {
    op: 'lessThan';
    field: string;
    value: unknown;
}
export interface ContainsPredicate {
    op: 'contains';
    field: string;
    value: unknown;
}
export interface InPredicate {
    op: 'in';
    field: string;
    values: unknown[];
}
export interface IsNullPredicate {
    op: 'isNull';
    field: string;
}
export interface IsNotNullPredicate {
    op: 'isNotNull';
    field: string;
}
export interface BetweenPredicate {
    op: 'between';
    field: string;
    low: unknown;
    high: unknown;
}
export interface StartsWithPredicate {
    op: 'startsWith';
    field: string;
    value: string;
}
export type PredicateSpec = EqualsPredicate | GreaterThanPredicate | LessThanPredicate | ContainsPredicate | InPredicate | IsNullPredicate | IsNotNullPredicate | BetweenPredicate | StartsWithPredicate;
//# sourceMappingURL=types.d.ts.map