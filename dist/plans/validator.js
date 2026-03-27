"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlan = validatePlan;
const metadata_1 = require("../schema/metadata");
const config_1 = require("../config");
// ------------------------------------------------------------------
// Allowed value sets (mirror compiler — keep in sync)
// ------------------------------------------------------------------
const ALLOWED_OPS = new Set([
    '=', '!=', '<>', '>', '<', '>=', '<=',
    'LIKE', 'NOT LIKE', 'ILIKE',
    'IN', 'NOT IN',
    'IS NULL', 'IS NOT NULL',
    'BETWEEN',
]);
const ALLOWED_JOIN_TYPES = new Set([
    'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS',
]);
const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC']);
const ALLOWED_AGGREGATE_TYPES = new Set([
    'count', 'sum', 'avg', 'min', 'max',
]);
const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_.]*(\.\*)?$/;
// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function isValidIdentifier(value) {
    return IDENTIFIER_REGEX.test(value);
}
function error(field, message, suggestion) {
    return { severity: 'error', field, message, suggestion };
}
function warning(field, message, suggestion) {
    return { severity: 'warning', field, message, suggestion };
}
// ------------------------------------------------------------------
// Section validators
// ------------------------------------------------------------------
function validateEntity(plan, issues, schema) {
    if (!plan.entity) {
        issues.push(error('entity', 'Missing required field "entity".', 'Set "entity" to the name of the table you want to query.'));
        return;
    }
    if (!isValidIdentifier(plan.entity)) {
        issues.push(error('entity', `Invalid table name: "${plan.entity}".`, 'Use only alphanumeric characters and underscores.'));
        return;
    }
    if (!schema.tables[plan.entity]) {
        const available = Object.keys(schema.tables).join(', ');
        issues.push(error('entity', `Table "${plan.entity}" does not exist in schema.`, `Available tables: ${available}`));
    }
}
function validateSelect(plan, issues, schema) {
    if (!plan.select || plan.select.length === 0)
        return;
    const tableSchema = schema.tables[plan.entity];
    plan.select.forEach((field, i) => {
        if (!isValidIdentifier(field)) {
            issues.push(error(`select[${i}]`, `Invalid field identifier: "${field}".`, 'Use table.column or column notation only.'));
            return;
        }
        // Skip wildcard checks
        if (field.includes('*'))
            return;
        // Warn if field doesn't exist in schema (only when table is known)
        const availableColumns = getAllAvailableColumns(plan, schema);
        // Check if field is available (it could be fully qualified or unqualified)
        let fieldFound = false;
        if (field.includes('.')) {
            // Fully qualified field like "orders.item"
            fieldFound = !!availableColumns[field];
        }
        else {
            // Unqualified field like "item" - check if it exists in main table
            const unqualifiedInMain = `${plan.entity}.${field}`;
            fieldFound = !!availableColumns[unqualifiedInMain];
        }
        if (!fieldFound) {
            issues.push(warning(`select[${i}]`, `Column "${field}" not found in available tables.`, `Available columns: ${Object.keys(availableColumns).join(', ')}`));
        }
    });
}
function validateWhereConditions(conditions, issues, schema, plan, pathPrefix) {
    conditions.forEach((condition, i) => {
        const path = `${pathPrefix}[${i}]`;
        // Nested group
        if (condition.conditions) {
            if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) {
                issues.push(error(`${path}.conditions`, 'Nested condition group must be a non-empty array.'));
            }
            else {
                validateWhereConditions(condition.conditions, issues, schema, plan, `${path}.conditions`);
            }
            return;
        }
        // Field
        if (!condition.field) {
            issues.push(error(`${path}.field`, 'WHERE condition is missing "field".'));
        }
        else if (!isValidIdentifier(condition.field)) {
            issues.push(error(`${path}.field`, `Invalid field identifier: "${condition.field}".`));
        }
        else {
            // Schema-aware column check with joined tables
            const availableColumns = getAllAvailableColumns(plan, schema);
            // Check if field is available (it could be fully qualified or unqualified)
            let fieldFound = false;
            if (condition.field.includes('.')) {
                // Fully qualified field like "customers.name"
                fieldFound = !!availableColumns[condition.field];
            }
            else {
                // Unqualified field like "name" - check if it exists in main table
                const unqualifiedInMain = `${plan.entity}.${condition.field}`;
                fieldFound = !!availableColumns[unqualifiedInMain];
            }
            if (!fieldFound) {
                issues.push(warning(`${path}.field`, `Column "${condition.field}" not found in available tables.`, `Available columns: ${Object.keys(availableColumns).join(', ')}`));
            }
        }
        // Operator
        if (!condition.op) {
            issues.push(error(`${path}.op`, 'WHERE condition is missing "op".', `Use one of: ${[...ALLOWED_OPS].join(', ')}`));
        }
        else {
            const normalizedOp = condition.op.trim().toUpperCase();
            if (!ALLOWED_OPS.has(normalizedOp)) {
                issues.push(error(`${path}.op`, `Disallowed operator: "${condition.op}".`, `Use one of: ${[...ALLOWED_OPS].join(', ')}`));
            }
            // Value checks per operator
            if (normalizedOp === 'IS NULL' || normalizedOp === 'IS NOT NULL') {
                if (condition.value !== undefined) {
                    issues.push(warning(`${path}.value`, `"${normalizedOp}" does not use a value. Remove the "value" field.`));
                }
            }
            else if (normalizedOp === 'IN' || normalizedOp === 'NOT IN') {
                if (!Array.isArray(condition.value) || condition.value.length === 0) {
                    issues.push(error(`${path}.value`, `"${normalizedOp}" requires a non-empty array value.`, 'Set "value" to an array, e.g. [1, 2, 3].'));
                }
            }
            else if (normalizedOp === 'BETWEEN') {
                if (!Array.isArray(condition.value) || condition.value.length !== 2) {
                    issues.push(error(`${path}.value`, '"BETWEEN" requires exactly a [min, max] array.', 'Set "value" to a two-element array, e.g. [10, 50].'));
                }
            }
            else {
                if (condition.value === undefined || condition.value === null) {
                    issues.push(error(`${path}.value`, `Operator "${condition.op}" requires a "value".`));
                }
            }
        }
        // Logic connector
        if (condition.logic !== undefined) {
            if (!['AND', 'OR'].includes(condition.logic)) {
                issues.push(error(`${path}.logic`, `Invalid logic connector: "${condition.logic}".`, 'Use "AND" or "OR".'));
            }
        }
    });
}
function validateJoins(plan, issues, schema) {
    if (!plan.join || plan.join.length === 0)
        return;
    const tableSchema = schema.tables[plan.entity];
    plan.join.forEach((joinEntry, i) => {
        const joinTable = typeof joinEntry === 'string' ? joinEntry : joinEntry?.table;
        const joinType = typeof joinEntry === 'object' ? joinEntry?.type : undefined;
        if (!joinTable) {
            issues.push(error(`join[${i}]`, 'Join entry is missing a table name.'));
            return;
        }
        if (!isValidIdentifier(joinTable)) {
            issues.push(error(`join[${i}].table`, `Invalid join table name: "${joinTable}".`));
            return;
        }
        if (!schema.tables[joinTable]) {
            issues.push(error(`join[${i}].table`, `Join table "${joinTable}" does not exist in schema.`, `Available tables: ${Object.keys(schema.tables).join(', ')}`));
        }
        if (joinType) {
            const normalizedType = joinType.trim().toUpperCase();
            if (!ALLOWED_JOIN_TYPES.has(normalizedType)) {
                issues.push(error(`join[${i}].type`, `Invalid join type: "${joinType}".`, `Use one of: ${[...ALLOWED_JOIN_TYPES].join(', ')}`));
            }
        }
        // Check join condition exists in schema
        if (tableSchema && !tableSchema.joins?.[joinTable]) {
            issues.push(error(`join[${i}]`, `No join condition defined in schema between "${plan.entity}" and "${joinTable}".`, 'Add a join condition to your schema metadata or remove this join.'));
        }
    });
}
function validateAggregate(plan, issues) {
    if (!plan.aggregate)
        return;
    const aggregates = Array.isArray(plan.aggregate) ? plan.aggregate : [plan.aggregate];
    aggregates.forEach((agg, i) => {
        const path = `aggregate[${i}]`;
        if (!agg.type) {
            issues.push(error(`${path}.type`, 'Aggregate is missing "type".', `Use one of: ${[...ALLOWED_AGGREGATE_TYPES].join(', ')}`));
            return;
        }
        const type = agg.type.toLowerCase();
        if (!ALLOWED_AGGREGATE_TYPES.has(type)) {
            issues.push(error(`${path}.type`, `Unsupported aggregate type: "${agg.type}".`, `Use one of: ${[...ALLOWED_AGGREGATE_TYPES].join(', ')}`));
        }
        // count is the only one that doesn't require a field
        if (type !== 'count' && !agg.field) {
            issues.push(error(`${path}.field`, `Aggregate "${type}" requires a "field".`));
        }
        if (agg.field && !isValidIdentifier(agg.field)) {
            issues.push(error(`${path}.field`, `Invalid aggregate field: "${agg.field}".`));
        }
        if (agg.alias && !isValidIdentifier(agg.alias)) {
            issues.push(error(`${path}.alias`, `Invalid aggregate alias: "${agg.alias}".`));
        }
    });
}
function validateOrderBy(plan, issues) {
    if (!plan.orderBy)
        return;
    const entries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
    entries.forEach((entry, i) => {
        const path = `orderBy[${i}]`;
        if (!entry.field) {
            issues.push(error(`${path}.field`, 'ORDER BY entry is missing "field".'));
        }
        else if (!isValidIdentifier(entry.field)) {
            issues.push(error(`${path}.field`, `Invalid ORDER BY field: "${entry.field}".`));
        }
        if (!entry.direction) {
            issues.push(warning(`${path}.direction`, 'ORDER BY entry is missing "direction". Defaulting to ASC.', 'Set "direction" to "ASC" or "DESC" explicitly.'));
        }
        else if (!ALLOWED_DIRECTIONS.has(entry.direction.trim().toUpperCase())) {
            issues.push(error(`${path}.direction`, `Invalid direction: "${entry.direction}".`, 'Use "ASC" or "DESC".'));
        }
    });
}
function validateLimitOffset(plan, issues) {
    if (plan.limit !== undefined && plan.limit !== null) {
        const n = parseInt(String(plan.limit), 10);
        if (isNaN(n) || n < 1 || n > 100000) {
            issues.push(error('limit', `Invalid LIMIT value: "${plan.limit}".`, 'Use a positive integer between 1 and 100000.'));
        }
    }
    if (plan.offset !== undefined && plan.offset !== null) {
        const n = parseInt(String(plan.offset), 10);
        if (isNaN(n) || n < 0) {
            issues.push(error('offset', `Invalid OFFSET value: "${plan.offset}".`, 'Use a non-negative integer.'));
        }
        if ((plan.offset !== undefined) && (plan.limit === undefined || plan.limit === null)) {
            issues.push(warning('offset', 'OFFSET is set without a LIMIT. This may return unpredictable results.', 'Add a "limit" field alongside "offset".'));
        }
    }
}
function validateGroupBy(plan, issues) {
    if (!plan.groupBy || plan.groupBy.length === 0)
        return;
    plan.groupBy.forEach((field, i) => {
        if (!isValidIdentifier(field)) {
            issues.push(error(`groupBy[${i}]`, `Invalid GROUP BY field: "${field}".`));
        }
    });
    // Warn if GROUP BY fields are not in the SELECT
    if (plan.select && plan.select.length > 0) {
        plan.groupBy.forEach((field, i) => {
            if (!plan.select.includes(field)) {
                issues.push(warning(`groupBy[${i}]`, `GROUP BY field "${field}" is not present in "select". This may cause a SQL error.`, `Add "${field}" to the "select" array.`));
            }
        });
    }
}
// ------------------------------------------------------------------
// LLM feedback formatter
// ------------------------------------------------------------------
function buildLlmFeedback(issues) {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const lines = [
        'The query plan you generated has the following issues. Please correct them and return a revised plan.',
        '',
    ];
    if (errors.length > 0) {
        lines.push('ERRORS (must fix):');
        errors.forEach(e => {
            lines.push(`- [${e.field}] ${e.message}${e.suggestion ? ` Suggestion: ${e.suggestion}` : ''}`);
        });
    }
    if (warnings.length > 0) {
        lines.push('');
        lines.push('WARNINGS (should fix):');
        warnings.forEach(w => {
            lines.push(`- [${w.field}] ${w.message}${w.suggestion ? ` Suggestion: ${w.suggestion}` : ''}`);
        });
    }
    lines.push('');
    lines.push('Return ONLY the corrected JSON query plan with no explanation.');
    return lines.join('\n');
}
// ------------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------------
function getAllAvailableColumns(plan, schema) {
    const available = {};
    // Add columns from main entity
    const mainTable = schema.tables[plan.entity];
    if (mainTable) {
        Object.keys(mainTable.fields).forEach(field => {
            available[field] = true;
        });
    }
    // Add columns from joined tables
    if (plan.join && plan.join.length > 0) {
        plan.join.forEach(joinEntry => {
            const joinTable = typeof joinEntry === 'string' ? joinEntry : joinEntry?.table;
            const joinedTableSchema = schema.tables[joinTable];
            if (joinedTableSchema) {
                Object.keys(joinedTableSchema.fields).forEach(field => {
                    available[field] = true;
                });
            }
        });
    }
    // Debug logging
    const config = (0, config_1.getConfig)();
    if (config.app.debug) {
        console.log(`[Validator] Available columns for ${plan.entity}:`, Object.keys(available));
    }
    return available;
}
// ------------------------------------------------------------------
// Main validator
// ------------------------------------------------------------------
function validatePlan(plan) {
    const issues = [];
    const schema = (0, metadata_1.getSchemaMetadata)();
    // Skip validation for conversational plans (handled elsewhere)
    if (!plan.needsDb) {
        return {
            valid: true,
            issues: []
        };
    }
    validateEntity(plan, issues, schema);
    validateSelect(plan, issues, schema);
    validateAggregate(plan, issues);
    validateJoins(plan, issues, schema);
    validateGroupBy(plan, issues);
    validateOrderBy(plan, issues);
    validateLimitOffset(plan, issues);
    if (plan.where && plan.where.length > 0) {
        validateWhereConditions(plan.where, issues, schema, plan, 'where');
    }
    if (plan.having && plan.having.length > 0) {
        validateWhereConditions(plan.having, issues, schema, plan, 'having');
    }
    const hasErrors = issues.some(i => i.severity === 'error');
    const valid = !hasErrors;
    return {
        valid,
        issues,
        llmFeedback: valid ? undefined : buildLlmFeedback(issues),
    };
}
//# sourceMappingURL=validator.js.map