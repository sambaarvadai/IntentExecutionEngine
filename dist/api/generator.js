"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiGenerator = exports.APIGenerator = void 0;
const plans_1 = require("../plans");
class APIGenerator {
    constructor(config = {}) {
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
    async generateAPI(request, llm) {
        const constraints = { ...this.config.defaultConstraints, ...request.constraints };
        try {
            // Step 1: Generate the base QueryPlan
            const planResult = await this.generateQueryPlan(request.intent, llm);
            // Step 2: Generate API definition
            const api = await this.generateAPIDefinition(planResult.plan, request, constraints);
            // Step 3: Generate request examples
            const examples = await this.generateExamples(api, planResult.plan, request);
            // Step 4: Create final API definition
            const finalAPI = {
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
        }
        catch (error) {
            throw new Error(`API generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // ------------------------------------------------------------------
    // Step implementations
    // ------------------------------------------------------------------
    async generateQueryPlan(intent, llm) {
        try {
            const pipelineResult = await (0, plans_1.buildQueryPipeline)(intent, llm);
            // Extract the original plan from the pipeline, not the compiled result
            // The pipeline should expose the original plan that was validated
            const originalPlan = this.extractOriginalPlanFromPipeline(pipelineResult);
            return {
                plan: originalPlan,
                confidence: this.calculatePlanConfidence(pipelineResult)
            };
        }
        catch (error) {
            throw new Error(`Query plan generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    extractOriginalPlanFromPipeline(pipelineResult) {
        // The pipeline now exposes the original validated plan
        if (pipelineResult.originalPlan) {
            return pipelineResult.originalPlan;
        }
        throw new Error('Pipeline does not expose original QueryPlan');
    }
    async generateAPIDefinition(plan, request, constraints) {
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
    async generateExamples(api, plan, request) {
        const examples = [];
        // Generate example based on the original intent
        const mainExample = {
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
    getFirstAggregate(plan) {
        if (!plan.aggregate)
            return null;
        return Array.isArray(plan.aggregate) ? plan.aggregate[0] : plan.aggregate;
    }
    generateRoute(plan, intent) {
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
            }
            else {
                return `/${entity}/summary`;
            }
        }
        else if (plan.where && plan.where.length > 0) {
            // Filtered queries
            return `/${entity}/search`;
        }
        else if (plan.orderBy || plan.limit) {
            // Ordered or paginated queries
            return `/${entity}/list`;
        }
        else {
            // Simple list queries
            return `/${entity}`;
        }
    }
    determineMethod(plan, constraints) {
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
    generateLabel(plan, intent) {
        const entity = plan.entity || 'data';
        const aggregate = this.getFirstAggregate(plan);
        if (aggregate) {
            const aggType = aggregate.type;
            if (aggType === 'count') {
                return `Count ${entity}`;
            }
            else {
                return `${aggType.charAt(0).toUpperCase() + aggType.slice(1)} ${entity}`;
            }
        }
        if (plan.where && plan.where.length > 0) {
            return `Search ${entity}`;
        }
        return `List ${entity}`;
    }
    extractParameters(plan) {
        const params = [];
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
    extractFromConditions(conditions, params, source) {
        for (const condition of conditions) {
            if (condition.conditions && condition.conditions.length > 0) {
                // Nested condition group
                this.extractFromConditions(condition.conditions, params, source);
            }
            else {
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
    inferType(value) {
        if (Array.isArray(value))
            return 'array';
        if (typeof value === 'boolean')
            return 'boolean';
        if (typeof value === 'number')
            return 'number';
        return 'string';
    }
    generateDescription(plan, intent) {
        const entity = plan.entity || 'data';
        let description = `API endpoint for ${intent.toLowerCase()}`;
        const aggregate = this.getFirstAggregate(plan);
        if (aggregate) {
            description += `. Returns ${aggregate.type} of ${entity}`;
        }
        else if (plan.where && plan.where.length > 0) {
            description += `. Filters ${entity} based on provided criteria`;
        }
        else {
            description += `. Lists ${entity}`;
        }
        return description;
    }
    determineAuth(plan, constraints) {
        if (constraints.authRequired) {
            return {
                type: 'api_key',
                required: true
            };
        }
        return this.config.defaultAuth || { type: 'none', required: false };
    }
    generateExampleParams(paramDefs) {
        const params = {};
        for (const paramDef of paramDefs) {
            if (!paramDef.required)
                continue;
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
    generateExampleResponse(plan) {
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
            }
            else {
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
    generateVariationExample(api, plan) {
        if (!api.params || api.params.length === 0) {
            return null;
        }
        // Create an example with different parameter values
        const variationParams = {};
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
    calculateConfidence(planResult, api) {
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
    calculatePlanConfidence(pipelineResult) {
        if (!pipelineResult.finalValidation.valid) {
            return 0.3;
        }
        const issueCount = pipelineResult.finalValidation.issues.length;
        if (issueCount === 0) {
            return 0.9;
        }
        return Math.max(0.9 - (issueCount * 0.1), 0.5);
    }
    static getInstance(config) {
        if (!APIGenerator.instance) {
            APIGenerator.instance = new APIGenerator(config);
        }
        return APIGenerator.instance;
    }
}
exports.APIGenerator = APIGenerator;
// Export singleton instance for easy access
exports.apiGenerator = APIGenerator.getInstance();
//# sourceMappingURL=generator.js.map