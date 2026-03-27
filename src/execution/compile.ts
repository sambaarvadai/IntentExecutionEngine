import { QueryPlan } from '../plans/types';
import { getSchemaMetadata } from '../schema/metadata';

export interface CompiledQuery {
  sql: string;
  params: any[];
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

function validateIdentifier(value: string, context: string): string {
  // Allow table.column notation and wildcards like table.*
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*(\.\*)?$/.test(value)) {
    throw new Error(`Invalid identifier in ${context}: "${value}"`);
  }
  return value;
}

function validateOperator(op: string): string {
  const normalized = op.trim().toUpperCase();
  if (!ALLOWED_OPS.has(normalized)) {
    throw new Error(`Disallowed operator: "${op}"`);
  }
  return normalized;
}

function validateDirection(direction: string): string {
  const normalized = direction.trim().toUpperCase();
  if (!ALLOWED_DIRECTIONS.has(normalized)) {
    throw new Error(`Invalid ORDER BY direction: "${direction}"`);
  }
  return normalized;
}

function validateJoinType(joinType: string): string {
  const normalized = joinType.trim().toUpperCase();
  if (!ALLOWED_JOIN_TYPES.has(normalized)) {
    throw new Error(`Invalid join type: "${joinType}"`);
  }
  return normalized;
}

function validateLimit(limit: any): number {
  const n = parseInt(limit, 10);
  if (isNaN(n) || n < 1 || n > 100000) {
    throw new Error(`Invalid LIMIT value: "${limit}"`);
  }
  return n;
}

function validateOffset(offset: any): number {
  const n = parseInt(offset, 10);
  if (isNaN(n) || n < 0) {
    throw new Error(`Invalid OFFSET value: "${offset}"`);
  }
  return n;
}

// ------------------------------------------------------------------
// WHERE clause compiler
// ------------------------------------------------------------------

interface WhereCondition {
  field: string;
  op: string;
  value?: any;
  logic?: 'AND' | 'OR';           // logic connector BEFORE this condition
  conditions?: WhereCondition[];  // for nested groups: { logic: 'OR', conditions: [...] }
}

function compileWhereConditions(
  conditions: WhereCondition[],
  params: any[]
): string {
  const parts: string[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const connector = i === 0 ? '' : ` ${condition.logic ?? 'AND'} `;

    // Nested condition group
    if (condition.conditions && condition.conditions.length > 0) {
      const nested = compileWhereConditions(condition.conditions, params);
      parts.push(`${connector}(${nested})`);
      continue;
    }

    const field = validateIdentifier(condition.field, 'WHERE');
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
      const placeholders = condition.value.map(() => '?').join(', ');
      params.push(...condition.value);
      parts.push(`${connector}${field} ${op} (${placeholders})`);
      continue;
    }

    // BETWEEN — value must be [min, max]
    if (op === 'BETWEEN') {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new Error(`BETWEEN requires a [min, max] array for field "${field}"`);
      }
      params.push(condition.value[0], condition.value[1]);
      parts.push(`${connector}${field} BETWEEN ? AND ?`);
      continue;
    }

    // Case-insensitive equality for strings
    if (op === '=' && typeof condition.value === 'string') {
      params.push(condition.value);
      parts.push(`${connector}LOWER(${field}) = LOWER(?)`);
      continue;
    }

    // Default: single-value operator
    params.push(condition.value);
    parts.push(`${connector}${field} ${op} ?`);
  }

  return parts.join('');
}

// ------------------------------------------------------------------
// Aggregate compiler — supports multiple aggregates
// ------------------------------------------------------------------

interface Aggregate {
  type: string;
  field?: string;
  alias?: string;
}

function compileAggregate(aggregate: Aggregate): string {
  const type = aggregate.type.toLowerCase();
  if (!ALLOWED_AGGREGATE_TYPES.has(type)) {
    throw new Error(`Unsupported aggregation: "${aggregate.type}"`);
  }

  let expr: string;
  switch (type) {
    case 'count':
      expr = aggregate.field
        ? `COUNT(${validateIdentifier(aggregate.field, 'aggregate')})`
        : 'COUNT(*)';
      break;
    case 'sum':
    case 'avg':
    case 'min':
    case 'max':
      if (!aggregate.field) {
        throw new Error(`Aggregation "${type}" requires a field`);
      }
      expr = `${type.toUpperCase()}(${validateIdentifier(aggregate.field, 'aggregate')})`;
      break;
    default:
      throw new Error(`Unsupported aggregation: "${aggregate.type}"`);
  }

  return aggregate.alias ? `${expr} AS ${validateIdentifier(aggregate.alias, 'aggregate alias')}` : expr;
}

// ------------------------------------------------------------------
// Main compiler
// ------------------------------------------------------------------

export function compileQuery(plan: QueryPlan): CompiledQuery {
  const params: any[] = [];
  let sql = 'SELECT ';

  // --- SELECT clause ---
  const selectParts: string[] = [];

  // Support multiple aggregates
  if (plan.aggregate) {
    const aggregates = Array.isArray(plan.aggregate) ? plan.aggregate : [plan.aggregate];
    selectParts.push(...aggregates.map(compileAggregate));
  }

  // Non-aggregate select fields (coexist with aggregates for GROUP BY queries)
  if (plan.select && plan.select.length > 0) {
    const selectFields = plan.select.map(field => {
      if (field.includes('*')) {
        return field; // Keep wildcard as-is for any table
      }
      return validateIdentifier(field, 'SELECT');
    });
    selectParts.push(...selectFields);
  }

  sql += selectParts.length > 0 ? selectParts.join(', ') : '*';

  // --- FROM clause ---
  sql += ` FROM ${validateIdentifier(plan.entity!, 'FROM')}`;

  // --- JOINs ---
  if (plan.join && plan.join.length > 0) {
    const schemaMetadata = getSchemaMetadata(); // fetched once, outside the loop

    for (const joinEntry of plan.join) {
      // joinEntry can be a string (table name) or an object { table, type }
      const joinTable = typeof joinEntry === 'string' ? joinEntry : joinEntry.table;
      const joinType = typeof joinEntry === 'object' && joinEntry.type
        ? validateJoinType(joinEntry.type)
        : 'LEFT';

      const validatedJoinTable = validateIdentifier(joinTable, 'JOIN');
      const joinCondition = schemaMetadata.tables[plan.entity!]?.joins?.[validatedJoinTable];

      if (!joinCondition) {
        throw new Error(`No join condition defined between "${plan.entity}" and "${validatedJoinTable}"`);
      }

      sql += ` ${joinType} JOIN ${validatedJoinTable} ON ${joinCondition}`;
    }
  }

  // --- WHERE clause ---
  if (plan.where && plan.where.length > 0) {
    const whereClause = compileWhereConditions(plan.where, params);
    sql += ` WHERE ${whereClause}`;
  }

  // --- GROUP BY ---
  // Explicit groupBy field takes priority; falls back to select fields when aggregate is present
  if (plan.groupBy && plan.groupBy.length > 0) {
    const groupFields = plan.groupBy.map(f => validateIdentifier(f, 'GROUP BY'));
    sql += ` GROUP BY ${groupFields.join(', ')}`;
  } else if (plan.aggregate && plan.select && plan.select.length > 0) {
    const groupFields = plan.select.map(f => validateIdentifier(f, 'GROUP BY'));
    sql += ` GROUP BY ${groupFields.join(', ')}`;
  }

  // --- HAVING ---
  if (plan.having && plan.having.length > 0) {
    const havingClause = compileWhereConditions(plan.having, params);
    sql += ` HAVING ${havingClause}`;
  }

  // --- ORDER BY ---
  if (plan.orderBy) {
    const orderEntries = Array.isArray(plan.orderBy) ? plan.orderBy : [plan.orderBy];
    const orderClauses = orderEntries.map(entry => {
      const field = validateIdentifier(entry.field, 'ORDER BY');
      const direction = validateDirection(entry.direction);
      return `${field} ${direction}`;
    });
    sql += ` ORDER BY ${orderClauses.join(', ')}`;
  }

  // --- LIMIT ---
  if (plan.limit !== undefined && plan.limit !== null) {
    sql += ' LIMIT ?';
    params.push(validateLimit(plan.limit));
  }

  // --- OFFSET ---
  if (plan.offset !== undefined && plan.offset !== null) {
    sql += ' OFFSET ?';
    params.push(validateOffset(plan.offset));
  }

  return { sql, params };
}