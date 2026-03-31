import { GraphStatus } from '../graph/store/types';
export declare function handleGraphsList(params: {
    status?: GraphStatus;
    limit?: number;
    offset?: number;
    q?: string;
}): Promise<{
    success: boolean;
    data: {
        graphs: import("../graph/store").StoredGraph[];
        total: number;
    };
}>;
export declare function handleGraphStats(): Promise<{
    success: boolean;
    data: {
        total: number;
        byStatus: Record<GraphStatus, number>;
    };
}>;
export declare function handleGraphById(id: string): Promise<{
    success: boolean;
    error: string;
    data?: undefined;
} | {
    success: boolean;
    data: import("../graph/store").StoredGraph;
    error?: undefined;
}>;
export declare function handleUpdateGraphStatus(id: string, body: {
    status: GraphStatus;
    approvedBy?: string;
    approvalNote?: string;
}): Promise<{
    success: boolean;
    error: string;
    data?: undefined;
} | {
    success: boolean;
    data: import("../graph/store").StoredGraph;
    error?: undefined;
}>;
export declare function handleExecuteGraph(id: string): Promise<{
    success: boolean;
    error: string;
    data?: undefined;
} | {
    success: boolean;
    data: import("../graph/types").GraphResult;
    error?: undefined;
}>;
export declare function registerGraphHandlers(): {
    '/graphs': typeof handleGraphsList;
    '/graphs/stats': typeof handleGraphStats;
    '/graphs/:id': typeof handleGraphById;
    '/graphs/:id/status': typeof handleUpdateGraphStatus;
    '/graphs/:id/execute': typeof handleExecuteGraph;
};
//# sourceMappingURL=graphs.d.ts.map