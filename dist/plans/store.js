"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planStore = exports.PlanStore = void 0;
const types_1 = require("../context/types");
class PlanStore {
    constructor() {
        this.plans = new Map();
        this.nextId = 1;
    }
    // ------------------------------------------------------------------
    // Core CRUD operations
    // ------------------------------------------------------------------
    async save(plan, metadata) {
        const id = this.generateId();
        const now = new Date();
        const storage = {
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
    async update(id, updates, metadata) {
        const existing = this.plans.get(id);
        if (!existing) {
            throw new types_1.NotFoundError(`Plan with id ${id} not found`);
        }
        const updated = {
            ...existing,
            plan: { ...existing.plan, ...updates },
            updatedAt: new Date(),
            metadata: metadata ? { ...existing.metadata, ...metadata } : existing.metadata
        };
        this.plans.set(id, updated);
        console.log(`[PlanStore] Updated plan ${id}`);
        return updated;
    }
    async get(id) {
        const plan = this.plans.get(id);
        if (!plan) {
            throw new types_1.NotFoundError(`Plan with id ${id} not found`);
        }
        return plan;
    }
    async delete(id) {
        const existed = this.plans.delete(id);
        if (!existed) {
            throw new types_1.NotFoundError(`Plan with id ${id} not found`);
        }
        console.log(`[PlanStore] Deleted plan ${id}`);
    }
    // ------------------------------------------------------------------
    // Query operations
    // ------------------------------------------------------------------
    async query(query) {
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
    async list(limit = 50, offset = 0) {
        return this.query({ limit, offset });
    }
    // ------------------------------------------------------------------
    // Search operations
    // ------------------------------------------------------------------
    async findByEntity(entity) {
        return Array.from(this.plans.values()).filter(storage => storage.plan.entity === entity);
    }
    async findByNeedsDb(needsDb) {
        return Array.from(this.plans.values()).filter(storage => storage.plan.needsDb === needsDb);
    }
    async search(query) {
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
    async exists(id) {
        return this.plans.has(id);
    }
    async count() {
        return this.plans.size;
    }
    async clear() {
        this.plans.clear();
        console.log('[PlanStore] Cleared all plans');
    }
    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------
    generateId() {
        return `plan_${this.nextId++}`;
    }
    static getInstance() {
        if (!PlanStore.instance) {
            PlanStore.instance = new PlanStore();
        }
        return PlanStore.instance;
    }
}
exports.PlanStore = PlanStore;
// Export singleton instance for easy access
exports.planStore = PlanStore.getInstance();
//# sourceMappingURL=store.js.map