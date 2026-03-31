import { ExecutionNode } from '../types';
import { QueryPlan } from '../../plans/types';
export declare function buildQueryNode(params: {
    id: string;
    label: string;
    plan: QueryPlan;
    timeoutMs?: number;
}): ExecutionNode;
export declare function buildFilteredQueryNode(params: {
    id: string;
    label: string;
    entity: string;
    select: string[];
    field: string;
    op: string;
    value: any;
    timeoutMs?: number;
}): ExecutionNode;
export declare function buildPaginatedQueryNode(params: {
    id: string;
    label: string;
    entity: string;
    select: string[];
    limit: number;
    offset?: number;
    orderBy?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    timeoutMs?: number;
}): ExecutionNode;
//# sourceMappingURL=query.d.ts.map