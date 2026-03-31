import { 
  HandlerRequest, 
  HandlerResponse, 
  RequestContext, 
  ExecutionContext,
  UserContext,
  HandlerError,
  ResponseMetadata,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  APIError,
  DataAccessLabel
} from '../context/types';
import { APIDefinition } from '../context/types';
import { planStore, validatePlan } from '../plans';
import { compileQuery, executeCompiledQuery } from '../execution';
import { apiRegistry } from './index';
import { sanitiseParams } from './sanitise';
import { rateLimiter } from './rateLimit';
import { auditLog, type AuditEntry } from './audit';
import { filterResponse } from './responseFilter';
import { GraphRuntime } from '../graph/runtime';
import { ExecutionGraph } from '../graph/types';
import { graphRepository } from '../graph/store';

// ------------------------------------------------------------------
// Generic API Request Handler
// ------------------------------------------------------------------

export class APIHandler {
  // ------------------------------------------------------------------
  // Main request processing
  // ------------------------------------------------------------------

  async handleRequest(request: HandlerRequest): Promise<HandlerResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // 1. Load API definition
      const api = await this.loadAPI(request.apiId);
      
      // 2. Validate authentication
      const user = await this.authenticate(request, api);
      
      // ADD: Rate limit check
      const rateLimitKey = user ? `${user.id}:${api.id}` : `anon:${api.id}` 
      const rateLimitResult = rateLimiter.check(rateLimitKey)
      if (!rateLimitResult.allowed) {
        // audit: blocked request
        auditLog.log({
          requestId: requestId,
          timestamp: new Date(),
          userId: user?.id,
          apiId: api.id,
          planId: api.planId ?? (api as any).storedGraphId ?? '',
          route: api.route,
          method: api.method,
          paramKeys: Object.keys(request.params ?? {}),
          resultRowCount: 0,
          executionTimeMs: Date.now() - startTime,
          status: 'blocked'
        })
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.reason ?? 'Too many requests',
            details: { retryAfterMs: rateLimitResult.retryAfterMs }
          },
          metadata: {
            requestId: requestId,
            apiId: api.id,
            executionTime: Date.now() - startTime,
            planId: api.planId ?? (api as any).storedGraphId ?? '',
            params: request.params ?? {}
          }
        }
      }
      
      // 3. Validate and extract parameters
      const sanitisedParams = sanitiseParams(
        request.params,
        api.params ?? []
      )
      
      // 4. Create request context
      const context: RequestContext = {
        api,
        incomingParams: sanitisedParams,
        user,
        timestamp: new Date(),
        requestId: requestId
      };

      // 5. Hydrate plan with parameters or execute graph
      let result: any;
      if (this.hasExecutionGraph(api)) {
        result = await this.executeGraph(api, context);
      } else {
        const executionContext = await this.hydratePlan(context);
        result = await this.executeQuery(executionContext);
      }
      
      console.log('HANDLER dataLabel:', api.dataLabel, 'label:', api.label)

      // ADD: Filter response by API label + user roles
      const dataForFilter = result.type === 'graph_result' 
        ? { rows: Array.isArray(result.data) ? result.data : [result.data] }
        : result.data;
      
      const filteredResult = filterResponse(dataForFilter, {
        label: (api.dataLabel ?? 'public') as DataAccessLabel,
        userRoles: user?.roles ?? [],
        sensitiveFields: []
      })
      
      // ADD: Audit log for completed request
      auditLog.log({
        requestId: requestId,
        timestamp: new Date(),
        userId: user?.id,
        apiId: api.id,
        planId: api.planId ?? (api as any).storedGraphId ?? '',
        route: api.route,
        method: api.method,
        paramKeys: Object.keys(sanitisedParams),
        resultRowCount: result?.data?.rows?.length    // query result path
    ?? result?.data?.length                     // graph result finalOutput array
    ?? 0,
        executionTimeMs: Date.now() - startTime,
        status: 'success'
      })
      
      // 7. Build response
      const executionTime = Date.now() - startTime;
      const metadata: ResponseMetadata = {
        requestId: requestId,
        apiId: api.id,
        executionTime,
        planId: api.planId ?? (api as any).storedGraphId ?? '',
        params: request.params
      };
      
      // Use filteredResult appropriately based on whether filtering occurred
      const responseData = filteredResult?.filtered
        ? filteredResult
        : filteredResult;
      
      return {
        success: true,
        data: responseData,
        metadata
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // ADD: Audit log for errors
      auditLog.log({
        requestId: request.user 
          ? `${request.user.id}_${Date.now()}` 
          : `anon_${Date.now()}`,
        timestamp: new Date(),
        userId: request.user?.id,
        apiId: request.apiId,
        planId: '',
        route: '',
        method: '',
        paramKeys: Object.keys(request.params ?? {}),
        resultRowCount: 0,
        executionTimeMs: Date.now() - startTime,
        status: 'error',
        errorCode: error instanceof APIError ? error.code : 'INTERNAL_ERROR'
      })
      
      if (error instanceof APIError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          },
          metadata: {
            requestId: request.user ? `${request.user.id}_${Date.now()}` : `anon_${Date.now()}`,
            apiId: request.apiId,
            executionTime,
            planId: '',
            params: request.params ?? {}
          }
        };
      }
      
      // Handle unexpected errors
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: error instanceof Error ? error.message : String(error)
        },
        metadata: {
          requestId: request.user ? `${request.user.id}_${Date.now()}` : `anon_${Date.now()}`,
          apiId: request.apiId,
          executionTime,
          planId: '',
          params: request.params ?? {}
        }
      };
    }
  }

  // ------------------------------------------------------------------
  // Step implementations
  // ------------------------------------------------------------------

  private hasExecutionGraph(api: APIDefinition): boolean {
    return !!(api as any).executionGraph;
  }

  private getExecutionGraph(api: APIDefinition): ExecutionGraph {
    return (api as any).executionGraph as ExecutionGraph;
  }

  private async executeGraph(
    api: APIDefinition,
    context: RequestContext
  ): Promise<any> {
    const graph = this.getExecutionGraph(api);

    // Inject incoming params into query node plans inside the graph
    // Deep clone to avoid mutating the stored graph
    const hydratedGraph: ExecutionGraph = JSON.parse(JSON.stringify(graph));
    
    for (const node of hydratedGraph.nodes) {
      if (node.type === 'query' && node.plan) {
        this.injectParameters(node.plan, context.incomingParams);
      }
    }

    // Execute via GraphRuntime
    const runtime = new GraphRuntime();
    const result = await runtime.execute(hydratedGraph, {
      maxParallelNodes: 5,
      dryRun: false
    });

    return {
      type: 'graph_result',
      success: result.success,
      data: result.finalOutput,
      nodeResults: Object.fromEntries(result.nodeResults),
      totalExecutionTime: result.totalExecutionTime,
      failedNode: result.failedNode ?? null
    };
  }

  private async loadAPI(apiId: string): Promise<APIDefinition> {
    return apiRegistry.get(apiId);
  }

  private async authenticate(request: HandlerRequest, api: APIDefinition): Promise<UserContext | undefined> {
    // If no auth required, return undefined
    if (!api.auth?.required) {
      return undefined;
    }

    // Extract user from request (simplified - real implementation would check headers/tokens)
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Check roles if specified
    if (api.auth.roles && api.auth.roles.length > 0) {
      const hasRequiredRole = api.auth.roles.some(role => user.roles.includes(role));
      if (!hasRequiredRole) {
        throw new UnauthorizedError('Insufficient permissions');
      }
    }

    return user;
  }

  private async validateAndExtractParams(
    request: HandlerRequest, 
    api: APIDefinition, 
    user?: UserContext
  ): Promise<Record<string, any>> {
    const extractedParams: Record<string, any> = {};

    if (!api.params || api.params.length === 0) {
      return extractedParams;
    }

    for (const paramDef of api.params) {
      let value: any;

      // Extract parameter based on source
      switch (paramDef.source) {
        case 'query':
          value = request.params[paramDef.name];
          break;
        case 'path':
          // Path parameters would be extracted from the route
          // Simplified implementation
          value = request.params[paramDef.name];
          break;
        case 'header':
          value = request.headers[paramDef.name.toLowerCase()];
          break;
        case 'body':
          // Body parameters would be extracted from request body
          // Simplified implementation
          value = request.params[paramDef.name];
          break;
        default:
          throw new ValidationError(`Invalid parameter source: ${paramDef.source}`);
      }

      // Validate required parameters
      if (paramDef.required && (value === undefined || value === null)) {
        throw new ValidationError(`Required parameter '${paramDef.name}' is missing`);
      }

      // Skip validation for optional parameters that are not provided
      if (!paramDef.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation and conversion
      value = this.validateAndConvertType(value, paramDef);

      // Apply validation rules
      if (paramDef.validation) {
        this.applyValidationRules(value, paramDef);
      }

      extractedParams[paramDef.name] = value;
    }

    return extractedParams;
  }

  private validateAndConvertType(value: any, paramDef: any): any {
    switch (paramDef.type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new ValidationError(`Parameter '${paramDef.name}' must be a number`);
        }
        return num;
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        throw new ValidationError(`Parameter '${paramDef.name}' must be a boolean`);
      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          // Try to parse as JSON array
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // Fall through to error
          }
        }
        throw new ValidationError(`Parameter '${paramDef.name}' must be an array`);
      default:
        throw new ValidationError(`Unknown parameter type: ${paramDef.type}`);
    }
  }

  private applyValidationRules(value: any, paramDef: any): void {
    if (!paramDef.validation) return;

    for (const rule of paramDef.validation) {
      switch (rule.type) {
        case 'min':
          if (typeof value === 'number' && value < rule.value) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' must be at least ${rule.value}`);
          }
          if (typeof value === 'string' && value.length < rule.value) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' must be at least ${rule.value} characters`);
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > rule.value) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' must be at most ${rule.value}`);
          }
          if (typeof value === 'string' && value.length > rule.value) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' must be at most ${rule.value} characters`);
          }
          break;
        case 'pattern':
          const regex = new RegExp(rule.value);
          if (!regex.test(String(value))) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' does not match required pattern`);
          }
          break;
        case 'enum':
          if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
            throw new ValidationError(rule.message || `Parameter '${paramDef.name}' must be one of: ${rule.value.join(', ')}`);
          }
          break;
        case 'required':
          // Already handled in validateAndExtractParams
          break;
        default:
          throw new ValidationError(`Unknown validation rule: ${rule.type}`);
      }
    }
  }

  private async hydratePlan(context: RequestContext): Promise<ExecutionContext> {
    // Load the plan from store
    const planStorage = await planStore.get(context.api.planId);
    
    // Create a deep copy of the plan to avoid mutations
    const hydratedPlan = JSON.parse(JSON.stringify(planStorage.plan));
    
    // Inject parameters into the plan
    this.injectParameters(hydratedPlan, context.incomingParams);
    
    // Validate the hydrated plan
    const validationResult = validatePlan(hydratedPlan);
    
    if (!validationResult.valid) {
      throw new ValidationError(`Plan validation failed: ${validationResult.issues.map(i => i.message).join(', ')}`);
    }

    return {
      ...context,
      hydratedPlan,
      validationResult
    };
  }

  private injectParameters(plan: any, params: Record<string, any>): void {
    // Inject parameters into WHERE conditions
    if (plan.where && plan.where.length > 0) {
      this.injectIntoConditions(plan.where, params);
    }

    // Inject parameters into HAVING conditions
    if (plan.having && plan.having.length > 0) {
      this.injectIntoConditions(plan.having, params);
    }

    // Inject parameters into LIMIT
    if (plan.limit && typeof plan.limit === 'string' && plan.limit.startsWith(':')) {
      const paramName = plan.limit.substring(1);
      if (params[paramName] !== undefined) {
        plan.limit = params[paramName];
      }
    }

    // Inject parameters into OFFSET
    if (plan.offset && typeof plan.offset === 'string' && plan.offset.startsWith(':')) {
      const paramName = plan.offset.substring(1);
      if (params[paramName] !== undefined) {
        plan.offset = params[paramName];
      }
    }
  }

  private injectIntoConditions(conditions: any[], params: Record<string, any>): void {
    for (const condition of conditions) {
      if (condition.conditions) {
        // Nested condition group
        this.injectIntoConditions(condition.conditions, params);
      } else {
        // Single condition
        if (typeof condition.value === 'string' && condition.value.startsWith(':')) {
          const paramName = condition.value.substring(1);
          if (params[paramName] !== undefined) {
            condition.value = params[paramName];
          }
        }
      }
    }
  }

  private async executeQuery(context: ExecutionContext): Promise<any> {
    // Skip execution for conversational plans
    if (!context.hydratedPlan.needsDb) {
      return {
        type: 'conversational',
        message: 'This is a conversational response - no database query executed'
      };
    }

    // Compile the plan to SQL
    const compiled = compileQuery(context.hydratedPlan);
    
    // Execute the query using the proper execution module
    const result = await executeCompiledQuery(compiled);
    
    return {
      type: 'query_result',
      data: result.data,   // unwrap — don't return the whole ExecutionResult
      sql: compiled.sql,
      params: compiled.params
    };
  }

  // ------------------------------------------------------------------
  // Utility methods
  // ------------------------------------------------------------------

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ------------------------------------------------------------------
  // Singleton instance
  // ------------------------------------------------------------------

  private static instance: APIHandler;

  static getInstance(): APIHandler {
    if (!APIHandler.instance) {
      APIHandler.instance = new APIHandler();
    }
    return APIHandler.instance;
  }
}

// Export singleton instance for easy access
export const apiHandler = APIHandler.getInstance();
