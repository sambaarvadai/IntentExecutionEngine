import { APIDefinition, APIStatus, RegistryQuery, RegistryResult } from '../context/types';
export declare class APIRegistryManager {
    private registry;
    register(api: Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIDefinition>;
    update(id: string, updates: Partial<Omit<APIDefinition, 'id' | 'createdAt'>>): Promise<APIDefinition>;
    get(id: string): Promise<APIDefinition>;
    delete(id: string): Promise<void>;
    query(query: RegistryQuery): Promise<RegistryResult>;
    list(limit?: number, offset?: number): Promise<RegistryResult>;
    resolveRoute(method: string, route: string): Promise<APIDefinition>;
    findActiveRoutes(): Promise<APIDefinition[]>;
    findByPlanId(planId: string): Promise<APIDefinition[]>;
    updateStatus(id: string, newStatus: APIStatus): Promise<APIDefinition>;
    getMetrics(): Promise<RegistryMetrics>;
    private validateAPI;
    private updateStatusIndex;
    exists(id: string): Promise<boolean>;
    count(): Promise<number>;
    clear(): Promise<void>;
    private generateId;
    private static instance;
    static getInstance(): APIRegistryManager;
}
export interface RegistryMetrics {
    total: number;
    byStatus: Record<APIStatus, number>;
    lastUpdated: number;
}
export declare const apiRegistry: APIRegistryManager;
//# sourceMappingURL=registry.d.ts.map