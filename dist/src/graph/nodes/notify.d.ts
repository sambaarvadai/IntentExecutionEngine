import { ExecutionNode } from '../types';
export declare function buildLogNode(params: {
    id: string;
    label: string;
    dataKey?: string;
    prefix?: string;
}): ExecutionNode;
export declare function buildWebhookNode(params: {
    id: string;
    label: string;
    url: string;
    dataKey?: string;
    method?: 'POST' | 'PUT';
}): ExecutionNode;
//# sourceMappingURL=notify.d.ts.map