import { ExecutionNode } from '../types';
export declare function mergeByKey(params: {
    id: string;
    label: string;
    leftKey: string;
    rightKey: string;
    on: string;
    foreignKey: string;
    outputField: string;
}): ExecutionNode;
export declare function filterRows(params: {
    id: string;
    label: string;
    dataKey: string;
    predicate: (row: any) => boolean;
}): ExecutionNode;
export declare function pickFields(params: {
    id: string;
    label: string;
    dataKey: string;
    fields: string[];
}): ExecutionNode;
export declare function mapRows(params: {
    id: string;
    label: string;
    dataKey: string;
    mapper: (row: any) => any;
}): ExecutionNode;
export declare function sortRows(params: {
    id: string;
    label: string;
    dataKey: string;
    field: string;
    direction: 'asc' | 'desc';
}): ExecutionNode;
export declare function aggregateRows(params: {
    id: string;
    label: string;
    dataKey: string;
    groupBy?: string[];
    aggregations: {
        [field: string]: {
            count?: boolean;
            sum?: boolean;
            avg?: boolean;
            min?: boolean;
            max?: boolean;
        };
    };
}): ExecutionNode;
export declare function limitRows(params: {
    id: string;
    label: string;
    dataKey: string;
    n: number;
}): ExecutionNode;
//# sourceMappingURL=transform.d.ts.map