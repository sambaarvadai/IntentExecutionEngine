#!/usr/bin/env ts-node
declare const BASE_URL: string;
interface ValidationResponse {
    graphId: string;
    graph: any;
    generationMs: number;
    valid: boolean;
    nodeCount: number;
    cacheHit?: boolean;
    cacheScore?: number;
}
interface GraphResponse {
    id: string;
    prompt: string;
    status: string;
    nodeCount: number;
    graphJson: string;
    createdAt: string;
    updatedAt: string;
}
interface StatusUpdateResponse {
    id: string;
    status: string;
    approvedBy?: string;
    approvalNote?: string;
}
interface GraphStats {
    total: number;
    byStatus: Record<string, number>;
}
declare function post(url: string, body: any): Promise<any>;
declare function get(url: string): Promise<any>;
declare function patch(url: string, body: any): Promise<any>;
declare function log(step: string, data: any): void;
declare function sleep(ms: number): Promise<void>;
declare function main(): Promise<void>;
declare function checkServer(): Promise<boolean>;
declare function startWithServerCheck(): Promise<void>;
//# sourceMappingURL=live-test.d.ts.map