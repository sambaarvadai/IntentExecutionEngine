"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileQuery = compileQuery;
const metadata_1 = require("../schema/metadata");
const dialects_1 = require("./compiler/dialects");
function makeCollector(dialect) {
    let index = 0;
    const values = [];
    return {
        values,
        add(value) {
            values.push(value);
            return dialect.placeholder(++index);
        }
    };
}
// ------------------------------------------------------------------
// Allowlists — edit these to match your schema
// ------------------------------------------------------------------
const ALLOWED_OPS = new Set([
    '=', '!=', '<>', '>', '<', '>=', '<=',
    'LIKE', 'NOT LIKE', 'ILIKE',
    'IN', 'NOT IN',
    'IS NULL', 'IS NOT NULL',
    'BETWEEN',
    'STARTS WITH',
]);
const ALLOWED_JOIN_TYPES = new Set([
    'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS',
]);
const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC']);
const ALLOWED_AGGREGATE_TYPES = new Set([
    'count', 'sum', 'avg', 'min', 'max',
]);
// ------------------------------------------------------------------
// Identifier validation — blocks SQL injection through field/table names
// ------------------------------------------------------------------
function validateIdentifierRaw(value, context) {
    // Allow bare_name OR table.column — not more than one dot, OR table.*
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?(\.\*)?$/.test(value)) {
        throw new Error(`Invalid identifier in ${context}: "${value}"`);
    }
    return value;
}
function validateIdentifier(value, context, dialect) {
    // Wildcard: quote table part only, keep .*
    if (value.endsWith('.*')) {
        const table = value.slice(0, -2);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
            throw new Error(`Invalid identifier in ${context}: "${value}"`);
        }
        return `${dialect.quoteIdentifier(table)}.*`;
    }
    // Allow bare_name OR table.column — not more than one dot
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(value)) {
        throw new Error(`Invalid identifier in ${context}: "${value}"`);
    }
    return dialect.quoteIdentifier(value);
}
function validateOperator(op) {
    const normalized = op.trim().toUpperCase();
    if (!ALLOWED_OPS.has(normalized)) {
        throw new Error(`Disallowed operator: "${op}"`);
    }
    return normalized;
}
function validateDirection(direction) {
    const normalized = direction.trim().toUpperCase();
    if (!ALLOWED_DIRECTIONS.has(normalized)) {
        throw new Error(`Invalid ORDER BY direction: "${direction}"`);
    }
    return normalized;
}
function validateJoinType(joinType) {
    const normalized = joinType.trim().toUpperCase();
    if (!ALLOWED_JOIN_TYPES.has(normalized)) {
        throw new Error(`Invalid join type: "${joinType}"`);
    }
    return normalized;
}
function validateLimit(limit) {
    const n = parseInt(limit, 10);
    if (isNaN(n) || n < 1 || n > 100000) {
        throw new Error(`Invalid LIMIT value: "${limit}"`);
    }
    return n;
}
function validateOffset(offset) {
    const n = parseInt(offset, 10);
    if (isNaN(n) || n < 0) {
        throw new Error(`Invalid OFFSET value: "${offset}"`);
    }
    return n;
}
function compileWhereConditions(conditions, collector, dialect) {
    const parts = [];
    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const connector = i === 0 ? '' : ` ${condition.logic ?? 'AND'} `;
        // Nested condition group
        if (condition.conditions && condition.conditions.length > 0) {
            const nested = compileWhereConditions(condition.conditions, collector, dialect);
            parts.push(`${connector}(${nested})`);
            continue;
        }
        const field = validateIdentifierRaw(condition.field, 'WHERE');
        const op = validateOperator(condition.op);
        // Operators that take no value
        if (op === 'IS NULL' || op === 'IS NOT NULL') {
            parts.push(`${connector}${field} ${op}`);
            continue;
        }
        // IN / NOT IN — value must be a non-empty array
        if (op === 'IN' || op === 'NOT IN') {
            if (!Array.isArray(condition.value) || condition.value.length === 0) {
                throw new Error(`${op} requires a non-empty array value for field "${field}"`);
            }
            const placeholders = condition.value.map((v) => collector.add(v)).join(', ');
            parts.push(`${connector}${field} ${op} (${placeholders})`);
            continue;
        }
        // BETWEEN — value must be [min, max]
        if (op === 'BETWEEN') {
            if (!Array.isArray(condition.value) || condition.value.length !== 2) {
                throw new Error(`BETWEEN requires a [min, max] array for field "${field}"`);
            }
            const p1 = collector.add(condition.value[0]);
            const p2 = collector.add(condition.value[1]);
            parts.push(`${connector}${field} BETWEEN ${p1} AND ${p2}`);
            continue;
        }
        // STARTS WITH — value must be a string
        if (op === 'STARTS WITH') {
            if (typeof condition.value !== 'string') {
                throw new Error(`STARTS WITH requires a string value for field "${field}"`);
            }
            const p = collector.add(condition.value + '%');
            parts.push(`${connector}${field} LIKE ${p}`);
            continue;
        }
        // Case-insensitive equality — keep LOWER() for sqlite/mysql, 
        // use ILIKE for postgres:
        if (op === '=' && typeof condition.value === 'string') {
            const p = collector.add(condition.value);
            if (dialect.name === 'postgres') {
                parts.push(`${connector}${field} ILIKE ${p}`);
            }
            else {
                parts.push(`${connector}LOWER(${field}) = LOWER(${p})`);
            }
            continue;
        }
        // Default: single-value operator
        const p = collector.add(condition.value);
        parts.push(`${connector}${field} ${op} ${p}`);
    }
    return parts.join('');
}
function compileAggregate(aggregate, dialect) {
    const type = aggregate.type.toLowerCase();
    if (!ALLOWED_AGGREGATE_TYPES.has(type)) {
        throw new Error(`Unsupported aggregation: "${aggregate.type}"`);
    }
    let expr;
    switch (type) {
        case 'count':
            expr = aggregate.field
                ? `COUNT(${validateIdentifier(aggregate.field, 'aggregate', dialect)})`
                : 'COUNT(*)';
            break;
        case 'sum':
        case 'avg':
        case 'min':
        case 'max':
            if (!aggregate.field) {
                throw new Error(`Aggregation "${type}" requires a field`);
            }
            expr = `${type.toUpperCase()}(${validateIdentifier(aggregate.field, 'aggregate', dialect)})`;
            break;
        default:
            throw new Error(`Unsupported aggregation: "${aggregate.type}"`);
    }
    return aggregate.alias ? `${expr} AS ${validateIdentifier(aggregate.alias, 'aggregate alias', dialect)}` : expr;
}
// ------------------------------------------------------------------
// JOIN condition builder - supports both legacy joins and relationships
// ------------------------------------------------------------------
function buildJoinCondition(fromTable, toTable, schemaMetadata, dialect) {
    // First try joins map (legacy path)
    const rawCondition = schemaMetadata.tables[fromTable]?.joins?.[toTable];
    if (rawCondition) {
        // rawCondition is "orders.customer_id = customers.id"
        // Split on = and quote each side
        const [left, right] = rawCondition.split('=').map((s) => s.trim());
        return `${dialect.quoteIdentifier(left)} = ${dialect.quoteIdentifier(right)}`;
    }
    // Then try relationships derived from foreignKeys
    const rel = schemaMetadata.relationships?.find((r) => r.fromTable === fromTable && r.toTable === toTable ||
        r.fromTable === toTable && r.toTable === fromTable);
    if (rel) {
        const left = `${rel.fromTable}.${rel.fromField}`;
        const right = `${rel.toTable}.${rel.toField}`;
        return `${dialect.quoteIdentifier(left)} = ${dialect.quoteIdentifier(right)}`;
    }
    throw new Error(`No join condition defined between "${fromTable}" and "${toTable}"`);
}
// ------------------------------------------------------------------
// Main compiler
// ------------------------------------------------------------------
function compileQuery(plan, dialect = (0, dialects_1.getDialect)('sqlite') // default preserves current behaviour
) {
    const collector = makeCollector(dialect);
    let sql = 'SELECT ';
    // --- SELECT clause ---
    const selectParts = [];
    // Support multiple aggregates
    if (plan.aggregate) {
        const aggregates = Array.isArray(plan.aggregate) ? plan.aggregate : [plan.aggregate];
        selectParts.push(...aggregates.map(agg => compileAggregate(agg, dialect)));
    }
    // Non-aggregate select fields (coexist with aggregates for GROUP BY queries)
    if (plan.select && plan.select.length > 0) {
        const selectFields = plan.select.map(field => validateIdentifier(field, 'SELECT', dialect));
        selectParts.push(...selectFields);
    }
    sql += selectParts.length > 0 ? selectParts.join(', ') : '*';
    // --- FROM clause ---
    sql += ` FROM ${validateIdentifier(plan.entity, 'FROM', dialect)}`;
    // --- JOINs ---
    if (plan.join && plan.join.length > 0) {
        const schemaMetadata = (0, metadata_1.getSchemaMetadata)(); // fetched once, outside the loop
        for (const joinEntry of plan.join) {
            // joinEntry can be a string (table name) or an object { table, type }
            const joinTable = typeof joinEntry === 'string' ? joinEntry : joinEntry.table;
            const joinType = typeof joinEntry === 'object' && joinEntry.type
                ? validateJoinType(joinEntry.type)
                : 'LEFT';
            const joinCondition = buildJoinCondition(plan.entity, joinTable, schemaMetadata, dialect);
            const quotedJoinTable = dialect.quoteIdentifier(joinTable);
            sql += ` ${joinType} JOIN ${quotedJoinTable} ON ${joinCondition}`;
        }
    }
    // --- WHERE clause ---
    if (plan.where && plan.where.length > 0) {
        const whereClause = compileWhereConditions(plan.where, collector, dialect);
        sql += ` WHERE ${whereClause}`;
    }
    // --- GROUP BY ---
    // Explicit groupBy field takes priority; falls back to select fields when aggregate is present
    if (plan.groupBy && plan.groupBy.length > 0) {
        const groupFields = plan.groupBy.map(f => validateIdentifier(f, 'GROUP BY', dialect));
        sql += ` GROUP BY ${groupFields.join(', ')}`;
    }
    else if (plan.aggregate && plan.select && plan.select.length > 0) {
        const groupFields = plan.select.map(f => validateIdentifier(f, 'GROUP BY', dialect));
        sql += ` GROUP BY ${groupFields.join(', ')}`;
    }
    // --- HAVING ---
    if (plan.having && plan.having.length > 0) {
        const havingClause = compileWhereConditions(plan.having, collector, dialect);
        sql += ` HAVING ${havingClause}`;
    }
    // --- ORDER BY ---
    if (plan.orderBy) {
        const orderEntries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
        const orderClauses = orderEntries.map(entry => {
            const field = validateIdentifier(entry.field, 'ORDER BY', dialect);
            const direction = validateDirection(entry.direction);
            return `${field} ${direction}`;
        });
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }
    // --- LIMIT/OFFSET ---
    const limitOffsetClause = dialect.limitOffset(plan.limit !== undefined && plan.limit !== null ? validateLimit(plan.limit) : undefined, plan.offset !== undefined && plan.offset !== null ? validateOffset(plan.offset) : undefined);
    if (limitOffsetClause) {
        sql += ` ${limitOffsetClause}`;
        // Only push limit/offset params if the dialect uses placeholders
        // SQLite and MySQL use direct values in LIMIT/OFFSET, Postgres uses placeholders
        if (dialect.name === 'postgres') {
            if (plan.limit !== undefined && plan.limit !== null) {
                collector.add(validateLimit(plan.limit));
            }
            if (plan.offset !== undefined && plan.offset !== null) {
                collector.add(validateOffset(plan.offset));
            }
        }
    }
    return { sql, params: collector.values };
}
//# sourceMappingURL=compile.js.map