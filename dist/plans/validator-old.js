"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validatePlan = validatePlan;
exports.isValidPlan = isValidPlan;
const metadata_1 = require("../schema/metadata");
const metadata_2 = require("../schema/metadata");
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
function validatePlan(plan) {
    // Check if it's a conversational plan
    if (plan.needsDb === false && plan.responseMode === 'conversational') {
        return; // Conversational plans are always valid
    }
    // Must be a query plan if needsDb is true
    if (plan.needsDb !== true) {
        throw new ValidationError('Plan must specify needsDb as true or false');
    }
    const queryPlan = plan;
    const schemaMetadata = (0, metadata_1.getSchemaMetadata)();
    // Validate entity
    if (!queryPlan.entity) {
        throw new ValidationError('Query plan must specify an entity');
    }
    if (!(0, metadata_2.isTableAllowed)(queryPlan.entity)) {
        throw new ValidationError(`Entity "${queryPlan.entity}" is not allowed`);
    }
    // Validate joins
    if (queryPlan.join) {
        for (const join of queryPlan.join) {
            const joinTable = typeof join === 'string' ? join : join.table;
            if (!(0, metadata_2.isTableAllowed)(joinTable)) {
                throw new ValidationError(`Join table "${joinTable}" is not allowed`);
            }
        }
    }
    // Validate select fields
    if (queryPlan.select) {
        for (const field of queryPlan.select) {
            if (!(0, metadata_2.isFieldAllowed)(field)) {
                throw new ValidationError(`Select field "${field}" is not allowed`);
            }
        }
    }
    // Validate where conditions
    if (queryPlan.where) {
        for (const condition of queryPlan.where) {
            if (!(0, metadata_2.isFieldAllowed)(condition.field)) {
                throw new ValidationError(`Where field "${condition.field}" is not allowed`);
            }
            if (!(0, metadata_2.isOperatorAllowed)(condition.op)) {
                throw new ValidationError(`Operator "${condition.op}" is not allowed`);
            }
        }
    }
    // Validate aggregate
    if (queryPlan.aggregate) {
        const aggregates = Array.isArray(queryPlan.aggregate) ? queryPlan.aggregate : [queryPlan.aggregate];
        for (const aggregate of aggregates) {
            if (!(0, metadata_2.isAggregationAllowed)(aggregate.type)) {
                throw new ValidationError(`Aggregation "${aggregate.type}" is not allowed`);
            }
            if (aggregate.field && !(0, metadata_2.isFieldAllowed)(aggregate.field)) {
                throw new ValidationError(`Aggregate field "${aggregate.field}" is not allowed`);
            }
        }
    }
    // Validate orderBy
    if (queryPlan.orderBy) {
        const orderBys = Array.isArray(queryPlan.orderBy) ? queryPlan.orderBy : [queryPlan.orderBy];
        for (const orderBy of orderBys) {
            if (!(0, metadata_2.isFieldAllowed)(orderBy.field)) {
                throw new ValidationError(`Order field "${orderBy.field}" is not allowed`);
            }
            if (!['asc', 'desc'].includes(orderBy.direction)) {
                throw new ValidationError(`Order direction "${orderBy.direction}" must be "asc" or "desc"`);
            }
        }
    }
    // Validate limit
    if (queryPlan.limit !== undefined) {
        if (typeof queryPlan.limit !== 'number' || queryPlan.limit < 1) {
            throw new ValidationError('Limit must be a positive number');
        }
        if (queryPlan.limit > schemaMetadata.maxLimit) {
            throw new ValidationError(`Limit cannot exceed ${schemaMetadata.maxLimit}`);
        }
    }
    // Validate join relationships
    if (queryPlan.entity && queryPlan.join) {
        const tableDef = schemaMetadata.tables[queryPlan.entity];
        if (tableDef && tableDef.joins) {
            for (const join of queryPlan.join) {
                const joinTable = typeof join === 'string' ? join : join.table;
                if (!tableDef.joins[joinTable]) {
                    throw new ValidationError(`Join from "${queryPlan.entity}" to "${joinTable}" is not defined`);
                }
            }
        }
    }
}
function isValidPlan(plan) {
    try {
        validatePlan(plan);
        return true;
    }
    catch (error) {
        return false;
    }
}
//# sourceMappingURL=validator-old.js.map