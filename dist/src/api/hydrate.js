"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planHydrator = exports.PlanHydrator = void 0;
const types_1 = require("../context/types");
const plans_1 = require("../plans");
// ------------------------------------------------------------------
// Plan Hydration - Injects request parameters into QueryPlans
// ------------------------------------------------------------------
class PlanHydrator {
    // ------------------------------------------------------------------
    // Main hydration logic
    // ------------------------------------------------------------------
    async hydrate(context) {
        const warnings = [];
        try {
            // Create a deep copy of the plan to avoid mutations
            const hydratedPlan = JSON.parse(JSON.stringify(context.plan));
            // Inject parameters based on API parameter definitions
            if (context.api.params && context.api.params.length > 0) {
                this.injectParameters(hydratedPlan, context.params, context.api.params, warnings);
            }
            // Validate the hydrated plan
            const validationResult = (0, plans_1.validatePlan)(hydratedPlan);
            if (!validationResult.valid) {
                throw new types_1.ValidationError(`Plan validation failed: ${validationResult.issues.map(i => i.message).join(', ')}`);
            }
            return {
                hydratedPlan,
                validationResult,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        }
        catch (error) {
            if (error instanceof types_1.ValidationError) {
                throw error;
            }
            throw new types_1.ValidationError(`Plan hydration failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // ------------------------------------------------------------------
    // Parameter injection
    // ------------------------------------------------------------------
    injectParameters(plan, params, paramDefs, warnings) {
        // Create a mapping of parameter names to their definitions
        const paramDefMap = new Map(paramDefs.map(def => [def.name, def]));
        // Inject into WHERE conditions
        if (plan.where && plan.where.length > 0) {
            this.injectIntoConditions(plan.where, params, paramDefMap, warnings, 'where');
        }
        // Inject into HAVING conditions
        if (plan.having && plan.having.length > 0) {
            this.injectIntoConditions(plan.having, params, paramDefMap, warnings, 'having');
        }
        // Inject into LIMIT
        if (plan.limit !== undefined && plan.limit !== null) {
            plan.limit = this.injectValue(plan.limit, params, paramDefMap, warnings, 'limit');
        }
        // Inject into OFFSET
        if (plan.offset !== undefined && plan.offset !== null) {
            plan.offset = this.injectValue(plan.offset, params, paramDefMap, warnings, 'offset');
        }
        // Inject into SELECT fields (if they contain parameter references)
        if (plan.select && plan.select.length > 0) {
            plan.select = plan.select.map((field) => this.injectValue(field, params, paramDefMap, warnings, 'select'));
        }
        // Inject into ORDER BY
        if (plan.orderBy) {
            const orderEntries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
            plan.orderBy = orderEntries.map((entry) => ({
                field: this.injectValue(entry.field, params, paramDefMap, warnings, 'orderBy.field'),
                direction: entry.direction
            }));
        }
        // Inject into GROUP BY
        if (plan.groupBy && plan.groupBy.length > 0) {
            plan.groupBy = plan.groupBy.map((field) => this.injectValue(field, params, paramDefMap, warnings, 'groupBy'));
        }
    }
    injectIntoConditions(conditions, params, paramDefMap, warnings, context) {
        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            if (condition.conditions && condition.conditions.length > 0) {
                // Nested condition group
                this.injectIntoConditions(condition.conditions, params, paramDefMap, warnings, `${context}[${i}].conditions`);
            }
            else {
                // Single condition
                const fieldPath = `${context}[${i}]`;
                // Inject field value
                if (condition.field !== undefined) {
                    condition.field = this.injectValue(condition.field, params, paramDefMap, warnings, `${fieldPath}.field`);
                }
                // Inject operator value (rare, but supported)
                if (condition.op !== undefined) {
                    condition.op = this.injectValue(condition.op, params, paramDefMap, warnings, `${fieldPath}.op`);
                }
                // Inject condition value (most common)
                if (condition.value !== undefined) {
                    condition.value = this.injectValue(condition.value, params, paramDefMap, warnings, `${fieldPath}.value`);
                }
            }
        }
    }
    injectValue(value, params, paramDefMap, warnings, context) {
        // If value is not a string or doesn't contain parameter reference, return as-is
        if (typeof value !== 'string') {
            return value;
        }
        // Check for parameter references in the format :paramName
        const paramRefs = this.extractParameterReferences(value);
        if (paramRefs.length === 0) {
            return value;
        }
        let result = value;
        for (const paramName of paramRefs) {
            const paramDef = paramDefMap.get(paramName);
            if (!paramDef) {
                warnings.push(`Undefined parameter '${paramName}' referenced in ${context}`);
                continue;
            }
            if (params[paramName] === undefined) {
                if (paramDef.required) {
                    throw new types_1.ValidationError(`Required parameter '${paramName}' is missing for ${context}`);
                }
                else {
                    warnings.push(`Optional parameter '${paramName}' not provided for ${context}`);
                    continue;
                }
            }
            // Validate and convert the parameter value
            const validatedValue = this.validateParameterValue(params[paramName], paramDef, context, paramName);
            // Replace the parameter reference with the actual value
            if (paramRefs.length === 1 && result === `:${paramName}`) {
                // Simple substitution - return the value directly
                result = validatedValue;
            }
            else {
                // Complex substitution - replace in string
                result = result.replace(new RegExp(`:${paramName}`, 'g'), String(validatedValue));
            }
        }
        return result;
    }
    extractParameterReferences(value) {
        const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const matches = [];
        let match;
        while ((match = regex.exec(value)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    }
    validateParameterValue(value, paramDef, context, paramName) {
        // Type validation
        switch (paramDef.type) {
            case 'string':
                return String(value);
            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    throw new types_1.ValidationError(`Parameter '${paramName}' in ${context} must be a number, got ${typeof value}`);
                }
                return num;
            case 'boolean':
                if (typeof value === 'boolean')
                    return value;
                if (value === 'true' || value === '1')
                    return true;
                if (value === 'false' || value === '0')
                    return false;
                throw new types_1.ValidationError(`Parameter '${paramName}' in ${context} must be a boolean, got ${typeof value}`);
            case 'array':
                if (!Array.isArray(value)) {
                    throw new types_1.ValidationError(`Parameter '${paramName}' in ${context} must be an array, got ${typeof value}`);
                }
                return value;
            default:
                throw new types_1.ValidationError(`Unknown parameter type '${paramDef.type}' for parameter '${paramName}' in ${context}`);
        }
    }
    // ------------------------------------------------------------------
    // Advanced hydration features
    // ------------------------------------------------------------------
    async hydrateWithDefaults(context) {
        // Add default values for missing optional parameters
        const paramsWithDefaults = { ...context.params };
        if (context.api.params) {
            for (const paramDef of context.api.params) {
                if (!paramDef.required && paramsWithDefaults[paramDef.name] === undefined && paramDef.default !== undefined) {
                    paramsWithDefaults[paramDef.name] = paramDef.default;
                }
            }
        }
        // Create new context with defaults
        const contextWithDefaults = {
            ...context,
            params: paramsWithDefaults
        };
        return this.hydrate(contextWithDefaults);
    }
    async validateParameters(context) {
        const warnings = [];
        if (!context.api.params || context.api.params.length === 0) {
            return warnings;
        }
        for (const paramDef of context.api.params) {
            const value = context.params[paramDef.name];
            // Check required parameters
            if (paramDef.required && (value === undefined || value === null)) {
                warnings.push(`Required parameter '${paramDef.name}' is missing`);
                continue;
            }
            // Skip validation for optional parameters that are not provided
            if (!paramDef.required && (value === undefined || value === null)) {
                continue;
            }
            // Validate parameter type
            try {
                this.validateParameterValue(value, paramDef, 'validation', paramDef.name);
            }
            catch (error) {
                warnings.push(`Parameter '${paramDef.name}' validation failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Validate parameter rules
            if (paramDef.validation) {
                for (const rule of paramDef.validation) {
                    try {
                        this.applyValidationRule(value, rule, paramDef.name);
                    }
                    catch (error) {
                        warnings.push(`Parameter '${paramDef.name}' rule '${rule.type}' failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        }
        return warnings;
    }
    applyValidationRule(value, rule, paramName) {
        switch (rule.type) {
            case 'min':
                if (typeof value === 'number' && value < rule.value) {
                    throw new Error(`must be at least ${rule.value}`);
                }
                if (typeof value === 'string' && value.length < rule.value) {
                    throw new Error(`must be at least ${rule.value} characters`);
                }
                break;
            case 'max':
                if (typeof value === 'number' && value > rule.value) {
                    throw new Error(`must be at most ${rule.value}`);
                }
                if (typeof value === 'string' && value.length > rule.value) {
                    throw new Error(`must be at most ${rule.value} characters`);
                }
                break;
            case 'pattern':
                const regex = new RegExp(rule.value);
                if (!regex.test(String(value))) {
                    throw new Error(`does not match required pattern`);
                }
                break;
            case 'enum':
                if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
                    throw new Error(`must be one of: ${rule.value.join(', ')}`);
                }
                break;
            default:
                throw new Error(`Unknown validation rule: ${rule.type}`);
        }
    }
    static getInstance() {
        if (!PlanHydrator.instance) {
            PlanHydrator.instance = new PlanHydrator();
        }
        return PlanHydrator.instance;
    }
}
exports.PlanHydrator = PlanHydrator;
// Export singleton instance for easy access
exports.planHydrator = PlanHydrator.getInstance();
//# sourceMappingURL=hydrate.js.map