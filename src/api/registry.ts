import { APIDefinition, APIStatus, APIRegistry, RegistryQuery, RegistryResult, NotFoundError, ValidationError } from '../context/types';
import { planStore } from '../plans';

// ------------------------------------------------------------------
// API Registry - Manages API definitions
// ------------------------------------------------------------------

export class APIRegistryManager {
  private registry: APIRegistry = {
    apis: new Map(),
    indexByRoute: new Map(),
    indexByStatus: new Map()
  };

  // ------------------------------------------------------------------
  // Core CRUD operations
  // ------------------------------------------------------------------

  async register(api: Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIDefinition> {
    const id = this.generateId();
    const now = new Date();
    
    const fullApi: APIDefinition = {
      ...api,
      id,
      createdAt: now,
      updatedAt: now
    };

    console.log('REGISTRY storing dataLabel:', fullApi.dataLabel)
    // Validate the API definition
    this.validateAPI(fullApi);

    // Check for route conflicts
    const routeKey = `${api.method}:${api.route}`;
    if (this.registry.indexByRoute.has(routeKey)) {
      throw new ValidationError(`Route ${api.method} ${api.route} already exists`);
    }

    // Store the API
    this.registry.apis.set(id, fullApi);
    this.registry.indexByRoute.set(routeKey, id);
    
    // Update status index
    this.updateStatusIndex(id, api.status, undefined);

    console.log(`[APIRegistry] Registered API ${id}: ${api.method} ${api.route}`);
    return fullApi;
  }

  async update(id: string, updates: Partial<Omit<APIDefinition, 'id' | 'createdAt'>>): Promise<APIDefinition> {
    const existing = this.registry.apis.get(id);
    if (!existing) {
      throw new NotFoundError(`API with id ${id} not found`);
    }

    const oldStatus = existing.status;
    const updated: APIDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    // Validate the updated API
    this.validateAPI(updated);

    // Check for route conflicts if route/method changed
    if (updates.route || updates.method) {
      const oldRouteKey = `${existing.method}:${existing.route}`;
      const newRouteKey = `${updated.method}:${updated.route}`;
      
      if (oldRouteKey !== newRouteKey && this.registry.indexByRoute.has(newRouteKey)) {
        throw new ValidationError(`Route ${updated.method} ${updated.route} already exists`);
      }

      // Update route index
      this.registry.indexByRoute.delete(oldRouteKey);
      this.registry.indexByRoute.set(newRouteKey, id);
    }

    // Update status index if status changed
    if (updates.status && updates.status !== oldStatus) {
      this.updateStatusIndex(id, updates.status, oldStatus);
    }

    this.registry.apis.set(id, updated);
    console.log(`[APIRegistry] Updated API ${id}`);
    return updated;
  }

  async get(id: string): Promise<APIDefinition> {
    const api = this.registry.apis.get(id);
    if (!api) {
      throw new NotFoundError(`API with id ${id} not found`);
    }
    return api;
  }

  async delete(id: string): Promise<void> {
    const api = this.registry.apis.get(id);
    if (!api) {
      throw new NotFoundError(`API with id ${id} not found`);
    }

    // Remove from all indexes
    const routeKey = `${api.method}:${api.route}`;
    this.registry.indexByRoute.delete(routeKey);
    this.updateStatusIndex(id, undefined, api.status);
    this.registry.apis.delete(id);

    console.log(`[APIRegistry] Deleted API ${id}`);
  }

  // ------------------------------------------------------------------
  // Query operations
  // ------------------------------------------------------------------

  async query(query: RegistryQuery): Promise<RegistryResult> {
    let apis = Array.from(this.registry.apis.values());

    // Apply filters
    if (query.status) {
      apis = apis.filter(api => api.status === query.status);
    }

    if (query.route) {
      apis = apis.filter(api => api.route.includes(query.route!));
    }

    if (query.method) {
      apis = apis.filter(api => api.method === query.method);
    }

    if (query.label) {
      apis = apis.filter(api => api.label.toLowerCase().includes(query.label!.toLowerCase()));
    }

    // Sort by creation date (newest first)
    apis.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = apis.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    const paginatedApis = apis.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    console.log(`[APIRegistry] Query returned ${paginatedApis.length}/${total} APIs`);
    
    return {
      apis: paginatedApis,
      total,
      hasMore
    };
  }

  async list(limit: number = 50, offset: number = 0): Promise<RegistryResult> {
    return this.query({ limit, offset });
  }

  // ------------------------------------------------------------------
  // Route resolution
  // ------------------------------------------------------------------

  async resolveRoute(method: string, route: string): Promise<APIDefinition> {
    const routeKey = `${method}:${route}`;
    const apiId = this.registry.indexByRoute.get(routeKey);
    
    if (!apiId) {
      throw new NotFoundError(`No API found for ${method} ${route}`);
    }

    return this.get(apiId);
  }

  async findActiveRoutes(): Promise<APIDefinition[]> {
    return Array.from(this.registry.apis.values()).filter(api => api.status === 'ACTIVE');
  }

  async findByPlanId(planId: string): Promise<APIDefinition[]> {
    return Array.from(this.registry.apis.values()).filter(api => api.planId === planId);
  }

  // ------------------------------------------------------------------
  // Status management
  // ------------------------------------------------------------------

  async updateStatus(id: string, newStatus: APIStatus): Promise<APIDefinition> {
    return this.update(id, { status: newStatus });
  }

  async getMetrics(): Promise<RegistryMetrics> {
    const apis = Array.from(this.registry.apis.values());
    
    const statusCounts = apis.reduce((counts, api) => {
      counts[api.status] = (counts[api.status] || 0) + 1;
      return counts;
    }, {} as Record<APIStatus, number>);

    return {
      total: apis.length,
      byStatus: statusCounts,
      lastUpdated: Math.max(...apis.map(api => api.updatedAt.getTime()))
    };
  }

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  private validateAPI(api: APIDefinition): void {
    if (!api.route || api.route.trim() === '') {
      throw new ValidationError('API route is required');
    }

    if (!api.label || api.label.trim() === '') {
      throw new ValidationError('API label is required');
    }

    if (!api.planId || api.planId.trim() === '') {
      throw new ValidationError('API planId is required');
    }

    // Validate route format (basic validation)
    if (!api.route.startsWith('/')) {
      throw new ValidationError('API route must start with "/"');
    }

    // Validate status flow
    const validTransitions: Record<APIStatus, APIStatus[]> = {
      'GENERATED': ['DRAFT'],
      'DRAFT': ['REVIEW', 'DEPRECATED'],
      'REVIEW': ['ACTIVE', 'DRAFT', 'DEPRECATED'],
      'ACTIVE': ['DEPRECATED'],
      'DEPRECATED': ['DRAFT']
    };

    // For new APIs, only allow GENERATED or DRAFT
    // For updates, validate status transitions (simplified for now)
  }

  // ------------------------------------------------------------------
  // Index management
  // ------------------------------------------------------------------

  private updateStatusIndex(id: string, newStatus?: APIStatus, oldStatus?: APIStatus): void {
    if (oldStatus) {
      const oldSet = this.registry.indexByStatus.get(oldStatus);
      if (oldSet) {
        oldSet.delete(id);
        if (oldSet.size === 0) {
          this.registry.indexByStatus.delete(oldStatus);
        }
      }
    }

    if (newStatus) {
      if (!this.registry.indexByStatus.has(newStatus)) {
        this.registry.indexByStatus.set(newStatus, new Set());
      }
      this.registry.indexByStatus.get(newStatus)!.add(id);
    }
  }

  // ------------------------------------------------------------------
  // Utility methods
  // ------------------------------------------------------------------

  async exists(id: string): Promise<boolean> {
    return this.registry.apis.has(id);
  }

  async count(): Promise<number> {
    return this.registry.apis.size;
  }

  async clear(): Promise<void> {
    this.registry = {
      apis: new Map(),
      indexByRoute: new Map(),
      indexByStatus: new Map()
    };
    console.log('[APIRegistry] Cleared all APIs');
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private generateId(): string {
    return `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ------------------------------------------------------------------
  // Singleton instance
  // ------------------------------------------------------------------

  private static instance: APIRegistryManager;

  static getInstance(): APIRegistryManager {
    if (!APIRegistryManager.instance) {
      APIRegistryManager.instance = new APIRegistryManager();
    }
    return APIRegistryManager.instance;
  }
}

// ------------------------------------------------------------------
// Additional types
// ------------------------------------------------------------------

export interface RegistryMetrics {
  total: number;
  byStatus: Record<APIStatus, number>;
  lastUpdated: number;
}

// Export singleton instance for easy access
export const apiRegistry = APIRegistryManager.getInstance();
