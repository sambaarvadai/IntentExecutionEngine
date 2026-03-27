"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileQuery = compileQuery;
const metadata_1 = require("../schema/metadata");
function compileQuery(plan) {
    const params = [];
    let sql = 'SELECT ';
    // Handle SELECT clause
    if (plan.aggregate) {
        sql += compileAggregate(plan.aggregate);
    }
    else if (plan.select && plan.select.length > 0) {
        // Handle wildcard fields
        const selectFields = plan.select.map(field => {
            if (field.includes('*')) {
                return field; // Keep wildcard as-is for any table
            }
            return field;
        });
        sql += selectFields.join(', ');
    }
    else {
        sql += '*';
    }
    // Handle FROM and JOINs
    sql += ` FROM ${plan.entity}`;
    if (plan.join && plan.join.length > 0) {
        for (const joinTable of plan.join) {
            const schemaMetadata = (0, metadata_1.getSchemaMetadata)();
            const joinCondition = schemaMetadata.tables[plan.entity].joins?.[joinTable];
            if (joinCondition) {
                sql += ` LEFT JOIN ${joinTable} ON ${joinCondition}`;
            }
        }
    }
    // Handle WHERE clause
    if (plan.where && plan.where.length > 0) {
        sql += ' WHERE ';
        const whereConditions = plan.where.map(condition => {
            params.push(condition.value);
            // Use case-insensitive comparison for text fields
            if (condition.op === '=' && typeof condition.value === 'string') {
                return `LOWER(${condition.field}) = LOWER(?)`;
            }
            return `${condition.field} ${condition.op} ?`;
        });
        sql += whereConditions.join(' AND ');
    }
    // Handle GROUP BY for aggregates
    if (plan.aggregate && plan.select && plan.select.length > 0) {
        sql += ` GROUP BY ${plan.select.join(', ')}`;
    }
    // Handle ORDER BY
    if (plan.orderBy) {
        sql += ` ORDER BY ${plan.orderBy.field} ${plan.orderBy.direction.toUpperCase()}`;
    }
    // Handle LIMIT
    if (plan.limit) {
        sql += ` LIMIT ${plan.limit}`;
    }
    return { sql, params };
}
function compileAggregate(aggregate) {
    switch (aggregate.type) {
        case 'count':
            return aggregate.field ? `COUNT(${aggregate.field})` : 'COUNT(*)';
        case 'sum':
            return `SUM(${aggregate.field})`;
        case 'avg':
            return `AVG(${aggregate.field})`;
        case 'min':
            return `MIN(${aggregate.field})`;
        case 'max':
            return `MAX(${aggregate.field})`;
        default:
            throw new Error(`Unsupported aggregation: ${aggregate.type}`);
    }
}
//# sourceMappingURL=compile-old.js.map