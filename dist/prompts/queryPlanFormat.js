"use strict";
// ------------------------------------------------------------------
// QueryPlan Format - Single Source of Truth
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUERY_PLAN_RULES = exports.QUERY_PLAN_FORMAT = void 0;
exports.QUERY_PLAN_FORMAT = `
QUERYPLAN FORMAT:
{
  "needsDb": boolean,
  "entity": string,
  "select": ["field1", "field2"] or ["table.*"],
  "where": [
    {
      "field": "column_name",
      "op": "=", "!=", ">", "<", ">=", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL", "BETWEEN",
      "value": "value" (or array for IN/BETWEEN, omit for IS NULL/NOT NULL),
      "logic": "AND" or "OR" (for subsequent conditions)
    }
  ],
  "orderBy": [
    {
      "field": "column_name",
      "direction": "asc" or "desc"
    }
  ],
  "limit": number,
  "joins": [
    {
      "table": "table_name",
      "on": "table1.field = table2.field",
      "type": "INNER" or "LEFT" or "RIGHT"
    }
  ]
}

IMPORTANT: 
- If the request is conversational (greeting, thanks, etc.), set "needsDb": false. If the request needs a database query, set "needsDb": true
- Always include the primary table in "entity" if needsDb is true
- select can be specific fields or ["table.*"] for all fields
- where clause supports all standard SQL operators
- orderBy is optional, defaults to entity primary key
- limit is optional, defaults to maxLimit from schema
- joins are optional for related table queries
- For joins, include the joined table in the join array
- Always qualify field names with their table: "table_name.column_name" not just "column_name"
- For date filters, use ISO 8601 format strings. Never use relative expressions like 'last week'.
`;
// ------------------------------------------------------------------
// QueryPlan Validation Schema
// ------------------------------------------------------------------
exports.QUERY_PLAN_RULES = `
QUERYPLAN VALIDATION RULES:
1. If needsDb=true, entity must be a valid table name from schema
2. All fields in select must exist in entity or joined tables
3. All fields in where must exist in entity or joined tables
4. Operators must be from allowed operators list
5. Table names in joins must exist in schema
6. Join conditions must reference valid foreign key relationships
7. limit cannot exceed maxLimit from schema
8. All field types must match schema field types
9. Required fields cannot be null in where clauses
10. Aggregate functions only allowed in select with groupBy
`;
//# sourceMappingURL=queryPlanFormat.js.map