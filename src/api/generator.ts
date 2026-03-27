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
import { buildQueryPipeline, LLMAdapter } from '../plans';

// ------------------------------------------------------------------
// API Generator - Creates API definitions from natural language
// ------------------------------------------------------------------

export interface APIGeneratorConfig {
  defaultAuth?: AuthConfig;
  defaultConstraints?: GenerationConstraints;
  maxRetries?: number;
}

export class APIGenerator {
  private config: APIGeneratorConfig;

  constructor(config: APIGeneratorConfig = {}) {
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

  async generateAPI(request: GenerationRequest, llm: LLMAdapter): Promise<GenerationResult> {
    const constraints = { ...this.config.defaultConstraints, ...request.constraints };
    
    try {
      // Step 1: Generate the base QueryPlan
      const planResult = await this.generateQueryPlan(request.intent, llm);
      
      // Step 2: Generate API definition
      const api = await this.generateAPIDefinition(planResult.plan, request, constraints);
      
      // Step 3: Generate request examples
      const examples = await this.generateExamples(api, planResult.plan, request);
      
      // Step 4: Create final API definition
      const finalAPI: APIDefinition = {
        id: '', // Will be set when saved
        ...api,
        examples,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        api: finalAPI,
        plan: planResult.plan,
        confidence: this.calculateConfidence(planResult, finalAPI),
        alternatives: [] // Could be implemented for multiple options
      };

    } catch (error) {
      throw new Error(`API generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ------------------------------------------------------------------
  // Step implementations
  // ------------------------------------------------------------------

  private async generateQueryPlan(intent: string, llm: LLMAdapter): Promise<{ plan: QueryPlan; confidence: number }> {
    try {
      const pipelineResult = await buildQueryPipeline(intent, llm);
      
      // Extract the original plan from the pipeline, not the compiled result
      // The pipeline should expose the original plan that was validated
      const originalPlan = this.extractOriginalPlanFromPipeline(pipelineResult);
      
      return {
        plan: originalPlan,
        confidence: this.calculatePlanConfidence(pipelineResult)
      };
    } catch (error) {
      throw new Error(`Query plan generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private extractOriginalPlanFromPipeline(pipelineResult: any): QueryPlan {
    // The pipeline now exposes the original validated plan
    if (pipelineResult.originalPlan) {
      return pipelineResult.originalPlan;
    }
    
    throw new Error('Pipeline does not expose original QueryPlan');
  }

  private async generateAPIDefinition(
    plan: QueryPlan, 
    request: GenerationRequest, 
    constraints: GenerationConstraints
  ): Promise<Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt' | 'examples'>> {
    
    // Generate route based on the plan's entity and purpose
    const route = this.generateRoute(plan, request.intent);
    
    // Determine HTTP method
    const method = this.determineMethod(plan, constraints);
    
    // Generate label
    const label = this.generateLabel(plan, request.intent);
    
    // Extract parameters from the plan
    const params = this.extractParameters(plan);
    
    // Generate description
    const description = this.generateDescription(plan, request.intent);
    
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
      description
    };
  }

  private async generateExamples(
    api: Omit<APIDefinition, 'id' | 'createdAt' | 'updatedAt' | 'examples'>,
    plan: QueryPlan,
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

  private generateRoute(plan: QueryPlan, intent: string): string {
    if (!plan.entity) {
      return '/query';
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

  private determineMethod(plan: QueryPlan, constraints: GenerationConstraints): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    const allowedMethods = constraints.allowedMethods || ['GET', 'POST'];
    
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

  private generateLabel(plan: QueryPlan, intent: string): string {
    const entity = plan.entity || 'data';
    
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

  private extractParameters(plan: QueryPlan): ParameterDefinition[] {
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

  private generateDescription(plan: QueryPlan, intent: string): string {
    const entity = plan.entity || 'data';
    
    let description = `API endpoint for ${intent.toLowerCase()}`;
    
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

  private determineAuth(plan: QueryPlan, constraints: GenerationConstraints): AuthConfig {
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

  private generateExampleResponse(plan: QueryPlan): any {
    if (!plan.needsDb) {
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
    plan: QueryPlan
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

  private calculateConfidence(planResult: any, api: APIDefinition): number {
    // Simple confidence calculation based on validation and complexity
    let confidence = 0.8; // Base confidence
    
    // Adjust based on plan validation
    if (planResult.finalValidation && planResult.finalValidation.valid) {
      confidence += 0.1;
    }
    
    // Adjust based on API complexity
    if (api.params && api.params.length > 5) {
      confidence -= 0.1; // More complex APIs are less certain
    }
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculatePlanConfidence(pipelineResult: any): number {
    if (!pipelineResult.finalValidation.valid) {
      return 0.3;
    }
    
    const issueCount = pipelineResult.finalValidation.issues.length;
    if (issueCount === 0) {
      return 0.9;
    }
    
    return Math.max(0.9 - (issueCount * 0.1), 0.5);
  }

  // ------------------------------------------------------------------
  // Singleton instance
  // ------------------------------------------------------------------

  private static instance: APIGenerator;

  static getInstance(config?: APIGeneratorConfig): APIGenerator {
    if (!APIGenerator.instance) {
      APIGenerator.instance = new APIGenerator(config);
    }
    return APIGenerator.instance;
  }
}

// Export singleton instance for easy access
export const apiGenerator = APIGenerator.getInstance();
