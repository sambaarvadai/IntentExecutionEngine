import { ExecutionNode } from '../types';
export declare function ifEmpty(params: {
    id: string;
    label: string;
    dataKey: string;
    trueBranch: string;
    falseBranch: string;
}): ExecutionNode;
export declare function ifRowCountAbove(params: {
    id: string;
    label: string;
    dataKey: string;
    threshold: number;
    trueBranch: string;
    falseBranch: string;
}): ExecutionNode;
export declare function ifFieldEquals(params: {
    id: string;
    label: string;
    dataKey: string;
    field: string;
    value: any;
    trueBranch: string;
    falseBranch: string;
}): ExecutionNode;
export declare function ifHasRole(params: {
    id: string;
    label: string;
    role: string;
    trueBranch: string;
    falseBranch: string;
}): ExecutionNode;
//# sourceMappingURL=condition.d.ts.map