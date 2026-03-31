import { 
  GenerationRequest, 
  GenerationResult, 
  GenerationConstraints,
  APIDefinition,
  APIStatus,
  ParameterDefinition,
  ValidationRule,
  RequestExample,
  AuthConfig
} from '../context/types';
import { QueryPlan, AnyPlan } from '../plans/types';
import { ExecutionGraph } from '../graph/types';
import { IntentEngine } from '../intent';

// ------------------------------------------------------------------
// API Generator - Creates API definitions from natural language
// ------------------------------------------------------------------

export interface APIGeneratorConfig {
  defaultAuth?: AuthConfig;
  defaultConstraints?: GenerationConstraints;
  maxRetries?: number;
}

export class APIGenerator {
  constructor(
    private intentEngine: IntentEngine,
    private config: APIGeneratorConfig = {}
  ) {
    this.config = {
      defaultAuth: { type: 'none', required: false },
      defaultConstraints: {
        maxParams: 10,
        allowedMethods: ['GET', 'POST'],
        authRequired: false,
        responseFormat: 'json'
      },
      maxRetries: 3,
      ...config
    };
  }

  // ------------------------------------------------------------------
  // Main generation method
  // ------------------------------------------------------------------

  async generateAPI(
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const constraints = { ...this.config.defaultConstraints, ...request.constraints };
    
    try {
      // Step 1: Generate ExecutionGraph via intent engine
      const { graph, storedGraphId } = await this.generateExecutionGraph(
        request.intent
      );
      
      // Step 2: Extract primary plan for metadata derivation
      const primaryPlan = this.getPrimaryQueryPlan(graph);
      
      // Step 3: Generate API metadata (unchanged — still uses primaryPlan)
      const api = await this.generateAPIDefinition(
        primaryPlan, graph, request, constraints
      );
      
      // Step 4: Generate examples from primary plan
      const examples = await this.generateExamples(api, primaryPlan, request);
      
      // Step 5: Build final APIDefinition
      const finalAPI: APIDefinition = {
        id: '',
        ...api,
        examples,
        executionGraph: graph,          // ← store full graph
        generatingPrompts: [request.intent],
        createdFrom: 'intent',
        storedGraphId,                  // ← reference to graph store
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        api: finalAPI,
        graph,                          // ← replace plan with graph
        confidence: this.calculateConfidence(graph, finalAPI)
      };

    } catch (error) {
      throw new Error(`API generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ------------------------------------------------------------------
  // Step implementations
  // ------------------------------------------------------------------

  private async generateExecutionGraph(
    intent: string
  ): Promise<{ graph: ExecutionGraph; storedGraphId: string }> {
    const result = await this.intentEngine.execute({
      prompt: intent,
      options: { dryRun: false }
    });
    return { 
      graph: result.graph, 
      storedGraphId: result.storedGraphId 
    };
  }

  private getPrimaryQueryPlan(graph: ExecutionGraph): QueryPlan | null {
    const entryNode = graph.nodes.find(n => n.id === graph.entryNode);
    if (entryNode?.type === 'query' && entryNode.plan) {
      return entryNode.plan;
    }
    const firstQuery = graph.nodes.find(n => n.type === 'query');
    return firstQuery?.plan ?? null;
  }

  private async generateAPIDefinition(
    plan: QueryPlan | null,    // ← now nullable
    graph: ExecutionGraph,     // ← new param
    request: GenerationRequest,
    constraints: GenerationConstraints
  ): Promise<Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt' | 'examples'>> {
    
    // Generate route based on the plan's entity and purpose
    const route = this.generateRoute(plan, request.intent, graph);
    
    // Determine HTTP method
    const method = this.determineMethod(plan, constraints);
    
    // Generate label
    const label = this.generateLabel(plan, request.intent, graph);
    
    // Extract parameters from the plan
    const params = this.extractParameters(plan);
    
    // Generate description
    const description = this.generateDescription(plan, request.intent, graph);
    
    // Determine authentication requirements
    const auth = this.determineAuth(plan, constraints);

    return {
      route,
      method,
      planId: '', // Will be set when saved
      status: 'GENERATED',
      label,
      auth,
      params,
      description,
      nodeCount: graph.nodes.length
    };
  }

  private async generateExamples(
    api: Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt' | 'examples'>,
    plan: QueryPlan | null,
    request: GenerationRequest
  ): Promise<RequestExample[]> {
    const examples: RequestExample[] = [];

    // Generate example based on the original intent
    const mainExample: RequestExample = {
      description: `Example: ${request.intent}`,
      method: api.method,
      path: api.route,
      params: this.generateExampleParams(api.params || []),
      expectedResponse: this.generateExampleResponse(plan)
    };
    examples.push(mainExample);

    // Generate additional examples for different parameter combinations
    if (api.params && api.params.length > 0) {
      const variationExample = this.generateVariationExample(api, plan);
      if (variationExample) {
        examples.push(variationExample);
      }
    }

    return examples;
  }

  // ------------------------------------------------------------------
  // Helper methods
  // ------------------------------------------------------------------

  private getFirstAggregate(plan: QueryPlan): any {
    if (!plan.aggregate) return null;
    return Array.isArray(plan.aggregate) ? plan.aggregate[0] : plan.aggregate;
  }

  private generateRoute(plan: QueryPlan | null, intent: string, graph?: ExecutionGraph): string {
    if (!plan?.entity) {
      return graph?.label ? `/${graph.label.toLowerCase().replace(/\s+/g, '-')}` : '/query';
    }

    const entity = plan.entity.toLowerCase();
    
    // Generate REST-style route based on the query type
    if (plan.aggregate) {
      // Handle both single aggregate and array of aggregates
      const aggregate = this.getFirstAggregate(plan);
      
      // Aggregation queries - usually counts or summaries
      if (aggregate && aggregate.type === 'count') {
        return `/${entity}/count`;
      } else {
        return `/${entity}/summary`;
      }
    } else if (plan.where && plan.where.length > 0) {
      // Filtered queries
      return `/${entity}/search`;
    } else if (plan.orderBy || plan.limit) {
      // Ordered or paginated queries
      return `/${entity}/list`;
    } else {
      // Simple list queries
      return `/${entity}`;
    }
  }

  private determineMethod(plan: QueryPlan | null, constraints: GenerationConstraints): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    const allowedMethods = constraints.allowedMethods || ['GET', 'POST'];
    
    if (!plan) {
      return allowedMethods.includes('GET') ? 'GET' : 'POST';
    }
    
    // For data retrieval, GET is most appropriate
    if (plan.needsDb && !this.getFirstAggregate(plan)) {
      return allowedMethods.includes('GET') ? 'GET' : 'POST';
    }
    
    // For aggregations, GET is also appropriate
    if (this.getFirstAggregate(plan)) {
      return allowedMethods.includes('GET') ? 'GET' : 'POST';
    }
    
    // Default to POST for complex queries
    return allowedMethods.includes('POST') ? 'POST' : 'GET';
  }

  private generateLabel(plan: QueryPlan | null, intent: string, graph?: ExecutionGraph): string {
    if (!plan?.entity) {
      return graph?.label || 'Query Data';
    }
    
    const entity = plan.entity;
    
    const aggregate = this.getFirstAggregate(plan);
    if (aggregate) {
      const aggType = aggregate.type;
      if (aggType === 'count') {
        return `Count ${entity}`;
      } else {
        return `${aggType.charAt(0).toUpperCase() + aggType.slice(1)} ${entity}`;
      }
    }
    
    if (plan.where && plan.where.length > 0) {
      return `Search ${entity}`;
    }
    
    return `List ${entity}`;
  }

  private extractParameters(plan: QueryPlan | null): ParameterDefinition[] {
    if (!plan) {
      return [];
    }
    
    const params: ParameterDefinition[] = [];

    // Extract parameters from WHERE conditions
    if (plan.where && plan.where.length > 0) {
      this.extractFromConditions(plan.where, params, 'query');
    }

    // Extract parameters from HAVING conditions
    if (plan.having && plan.having.length > 0) {
      this.extractFromConditions(plan.having, params, 'query');
    }

    // Extract LIMIT and OFFSET as query parameters
    if (plan.limit !== undefined && plan.limit !== null) {
      params.push({
        name: 'limit',
        type: 'number',
        required: false,
        source: 'query',
        description: 'Maximum number of results to return',
        validation: [{ type: 'min', value: 1 }, { type: 'max', value: 1000 }]
      });
    }

    if (plan.offset !== undefined && plan.offset !== null) {
      params.push({
        name: 'offset',
        type: 'number',
        required: false,
        source: 'query',
        description: 'Number of results to skip (for pagination)',
        validation: [{ type: 'min', value: 0 }]
      });
    }

    return params;
  }

  private extractFromConditions(conditions: any[], params: ParameterDefinition[], source: 'query' | 'path'): void {
    for (const condition of conditions) {
      if (condition.conditions && condition.conditions.length > 0) {
        // Nested condition group
        this.extractFromConditions(condition.conditions, params, source);
      } else {
        // Single condition - extract field as parameter if it looks like a filter
        if (condition.field && !condition.field.includes('.')) {
          // Check if this parameter is already added
          const existing = params.find(p => p.name === condition.field);
          if (!existing) {
            params.push({
              name: condition.field,
              type: this.inferType(condition.value),
              required: false,
              source,
              description: `Filter by ${condition.field}`
            });
          }
        }
      }
    }
  }

  private inferType(value: any): 'string' | 'number' | 'boolean' | 'array' {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  private generateDescription(plan: QueryPlan | null, intent: string, graph?: ExecutionGraph): string {
    const entity = plan?.entity || (graph?.label ? graph.label.toLowerCase() : 'data');
    
    let description = `API endpoint for ${intent.toLowerCase()}`;
    
    if (!plan) {
      description += `. Processes ${graph?.label || 'request'}`;
      return description;
    }
    
    const aggregate = this.getFirstAggregate(plan);
    if (aggregate) {
      description += `. Returns ${aggregate.type} of ${entity}`;
    } else if (plan.where && plan.where.length > 0) {
      description += `. Filters ${entity} based on provided criteria`;
    } else {
      description += `. Lists ${entity}`;
    }
    
    return description;
  }

  private determineAuth(plan: QueryPlan | null, constraints: GenerationConstraints): AuthConfig {
    if (constraints.authRequired) {
      return {
        type: 'api_key',
        required: true
      };
    }
    
    return this.config.defaultAuth || { type: 'none', required: false };
  }

  private generateExampleParams(paramDefs: ParameterDefinition[]): Record<string, any> {
    const params: Record<string, any> = {};
    
    for (const paramDef of paramDefs) {
      if (!paramDef.required) continue;
      
      switch (paramDef.type) {
        case 'string':
          params[paramDef.name] = paramDef.name.includes('name') ? 'example' : 'example-value';
          break;
        case 'number':
          params[paramDef.name] = paramDef.name.includes('limit') ? 10 : 1;
          break;
        case 'boolean':
          params[paramDef.name] = true;
          break;
        case 'array':
          params[paramDef.name] = ['value1', 'value2'];
          break;
      }
    }
    
    return params;
  }

  private generateExampleResponse(plan: QueryPlan | null): any {
    if (!plan?.needsDb) {
      return {
        type: 'conversational',
        message: 'This is a conversational response'
      };
    }

    const aggregate = this.getFirstAggregate(plan);
    if (aggregate) {
      if (aggregate.type === 'count') {
        return { count: 42 };
      } else {
        return { [aggregate.type]: 1000.50 };
      }
    }

    // Return example data structure
    return {
      data: [
        { id: 1, name: 'Example' }
      ],
      total: 1
    };
  }

  private generateVariationExample(
    api: Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt' | 'examples'>,
    plan: QueryPlan | null
  ): RequestExample | null {
    if (!api.params || api.params.length === 0) {
      return null;
    }

    // Create an example with different parameter values
    const variationParams: Record<string, any> = {};
    
    for (const paramDef of api.params) {
      if (!paramDef.required) {
        // Include an optional parameter in the variation
        switch (paramDef.type) {
          case 'string':
            variationParams[paramDef.name] = 'variation-value';
            break;
          case 'number':
            variationParams[paramDef.name] = 5;
            break;
          case 'boolean':
            variationParams[paramDef.name] = false;
            break;
        }
      }
    }

    if (Object.keys(variationParams).length === 0) {
      return null;
    }

    return {
      description: `Example with optional parameters`,
      method: api.method,
      path: api.route,
      params: variationParams,
      expectedResponse: this.generateExampleResponse(plan)
    };
  }

  // ------------------------------------------------------------------
  // Confidence calculation
  // ------------------------------------------------------------------

  private calculateConfidence(
    graph: ExecutionGraph, 
    api: APIDefinition
  ): number {
    let confidence = 0.8;
    // More nodes = more complexity = slightly less confident
    if (graph.nodes.length > 5) confidence -= 0.1;
    if (graph.nodes.length > 10) confidence -= 0.1;
    if (api.params && api.params.length > 5) confidence -= 0.1;
    return Math.min(Math.max(confidence, 0), 1);
  }
}

  
