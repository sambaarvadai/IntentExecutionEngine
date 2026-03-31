import { QueryPlan } from './types';
import { StoreQuery, StoreResult } from '../context/types';
export interface PlanStorage {
    id: string;
    plan: QueryPlan;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}
export declare class PlanStore {
    private plans;
    private nextId;
    save(plan: QueryPlan, metadata?: Record<string, any>): Promise<PlanStorage>;
    update(id: string, updates: Partial<QueryPlan>, metadata?: Record<string, any>): Promise<PlanStorage>;
    get(id: string): Promise<PlanStorage>;
    delete(id: string): Promise<void>;
    query(query: StoreQuery): Promise<StoreResult<PlanStorage>>;
    list(limit?: number, offset?: number): Promise<StoreResult<PlanStorage>>;
    findByEntity(entity: string): Promise<PlanStorage[]>;
    findByNeedsDb(needsDb: boolean): Promise<PlanStorage[]>;
    search(query: string): Promise<PlanStorage[]>;
    exists(id: string): Promise<boolean>;
    count(): Promise<number>;
    clear(): Promise<void>;
    private generateId;
    private static instance;
    static getInstance(): PlanStore;
}
export declare const planStore: PlanStore;
//# sourceMappingURL=store.d.ts.map