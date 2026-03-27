import { QueryPlan } from './types';
import { StoreQuery, StoreResult, NotFoundError } from '../context/types';

// ------------------------------------------------------------------
// In-memory Plan Store
// ------------------------------------------------------------------

export interface PlanStorage {
  id: string;
  plan: QueryPlan;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export class PlanStore {
  private plans: Map<string, PlanStorage> = new Map();
  private nextId: number = 1;

  // ------------------------------------------------------------------
  // Core CRUD operations
  // ------------------------------------------------------------------

  async save(plan: QueryPlan, metadata?: Record<string, any>): Promise<PlanStorage> {
    const id = this.generateId();
    const now = new Date();
    
    const storage: PlanStorage = {
      id,
      plan,
      createdAt: now,
      updatedAt: now,
      metadata
    };

    this.plans.set(id, storage);
    console.log(`[PlanStore] Saved plan ${id}`);
    return storage;
  }

  async update(id: string, updates: Partial<QueryPlan>, metadata?: Record<string, any>): Promise<PlanStorage> {
    const existing = this.plans.get(id);
    if (!existing) {
      throw new NotFoundError(`Plan with id ${id} not found`);
    }

    const updated: PlanStorage = {
      ...existing,
      plan: { ...existing.plan, ...updates },
      updatedAt: new Date(),
      metadata: metadata ? { ...existing.metadata, ...metadata } : existing.metadata
    };

    this.plans.set(id, updated);
    console.log(`[PlanStore] Updated plan ${id}`);
    return updated;
  }

  async get(id: string): Promise<PlanStorage> {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new NotFoundError(`Plan with id ${id} not found`);
    }
    return plan;
  }

  async delete(id: string): Promise<void> {
    const existed = this.plans.delete(id);
    if (!existed) {
      throw new NotFoundError(`Plan with id ${id} not found`);
    }
    console.log(`[PlanStore] Deleted plan ${id}`);
  }

  // ------------------------------------------------------------------
  // Query operations
  // ------------------------------------------------------------------

  async query(query: StoreQuery): Promise<StoreResult<PlanStorage>> {
    let items = Array.from(this.plans.values());

    // Apply filters
    if (query.id) {
      items = items.filter(item => item.id === query.id);
    }

    // Apply pagination
    const total = items.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    const paginatedItems = items.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    console.log(`[PlanStore] Query returned ${paginatedItems.length}/${total} items`);
    
    return {
      items: paginatedItems,
      total,
      hasMore
    };
  }

  async list(limit: number = 50, offset: number = 0): Promise<StoreResult<PlanStorage>> {
    return this.query({ limit, offset });
  }

  // ------------------------------------------------------------------
  // Search operations
  // ------------------------------------------------------------------

  async findByEntity(entity: string): Promise<PlanStorage[]> {
    return Array.from(this.plans.values()).filter(
      storage => storage.plan.entity === entity
    );
  }

  async findByNeedsDb(needsDb: boolean): Promise<PlanStorage[]> {
    return Array.from(this.plans.values()).filter(
      storage => storage.plan.needsDb === needsDb
    );
  }

  async search(query: string): Promise<PlanStorage[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.plans.values()).filter(storage => {
      // Search in plan properties
      if (storage.plan.entity && storage.plan.entity.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Search in metadata
      if (storage.metadata) {
        const metadataStr = JSON.stringify(storage.metadata).toLowerCase();
        return metadataStr.includes(searchTerm);
      }
      
      return false;
    });
  }

  // ------------------------------------------------------------------
  // Utility methods
  // ------------------------------------------------------------------

  async exists(id: string): Promise<boolean> {
    return this.plans.has(id);
  }

  async count(): Promise<number> {
    return this.plans.size;
  }

  async clear(): Promise<void> {
    this.plans.clear();
    console.log('[PlanStore] Cleared all plans');
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private generateId(): string {
    return `plan_${this.nextId++}`;
  }

  // ------------------------------------------------------------------
  // Singleton instance
  // ------------------------------------------------------------------

  private static instance: PlanStore;

  static getInstance(): PlanStore {
    if (!PlanStore.instance) {
      PlanStore.instance = new PlanStore();
    }
    return PlanStore.instance;
  }
}

// Export singleton instance for easy access
export const planStore = PlanStore.getInstance();
