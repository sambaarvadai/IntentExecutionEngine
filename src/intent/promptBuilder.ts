// ------------------------------------------------------------------
// Intent Prompt Builder
// ------------------------------------------------------------------

import { SchemaMetadata } from '../schema/metadata';

export function buildIntentPrompt(schema: SchemaMetadata): string {
  const today = new Date().toISOString().split('T')[0];
  const twoYearsAgo = new Date(Date.now() - (2 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  const dateFormat = (schema as any).dateFormat ?? 'ISO8601';
  const dateExample = (schema as any).dateExample ?? '2024-01-15T00:00:00Z';
  
  return `You are a database query intent parser. 
Analyze user's natural language query and return a QueryIntent.

SCHEMA:
${JSON.stringify(schema, null, 2)}

RELATIONSHIPS:
${schema.relationships?.map(rel => `  ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField}`).join('\n') || '  No relationships defined'}
— these are handled automatically, do not specify joins

Return ONLY this JSON shape:
{
  "tables": string[],      // tables needed, primary table first
  "filters": [{ "field": "table.column", "op": "=", "value": ... }],
  "select": string[],      // always empty — compiler handles column selection
  "orderBy": [{ "field": "...", "direction": "asc"|"desc" }],
  "limit": number,
  "groupBy": string[],   // optional, for distinct/grouped queries
  "distinct": boolean,   // optional, for SELECT DISTINCT
  "aggregate": [{ "type": "sum|count|avg|min|max", "field": "...", "alias": "..." }], // optional, for aggregation
  "having": [{ "field": "alias_or_expression", "op": ">", "value": ... }]  // optional, filters on aggregate results (post-GROUP BY)
  "conversational": boolean
}

FILTER OPERATORS:
"op": "=" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | 
      "LIKE" | "IS NULL" | "IS NOT NULL" | "BETWEEN"

RULES:
- Never specify join conditions — they are inferred from schema
- For temporal filters use ISO date strings
- For "last N years/months/days" compute from today: ${today}
- tables[] order matters: primary table first, joined tables after
- If query is a greeting or conversation, set conversational: true
  and leave other fields empty

FIELD NAME RULES:
- Single-table: bare column names in filters ("city", "created_at")
- Multi-table: table-prefixed in filters ("orders.created_at")
- select[]: always empty — compiler handles column selection
- Omit orderBy entirely if no sorting is needed — do not return 
  an empty orderBy array
- Omit filters entirely if no filtering is needed, or return []

AGGREGATION RULES:
- Use aggregate[] for sum, count, avg, min, max queries
- When aggregating, set limit to 1 for single-value results
  unless groupBy is also set
- Never try to express aggregation through select[] 
- Use having[] to filter on aggregate results
- having[] uses the aggregate alias as the field name
- Example: filter customers where total spend > 50000 uses
  having: [{"field": "total_spent", "op": ">", "value": 50000}]
- Never use where[] to filter on aggregate results 

DATE FORMAT:
  - Date values are stored as: ${dateExample}
  - Always use full ISO format with time for date comparisons:
    "YYYY-MM-DDT00:00:00Z"
  - Correct: "2024-03-31T00:00:00Z"  Wrong: "2024-03-31"

NULL / MISSING RECORD PATTERNS:
  - "never", "no orders", "without orders", "has no X" → 
    use LEFT JOIN on the related table + IS NULL filter on 
    the joined table's primary key
  - Primary table goes first in tables[], joined table second
  - Filter: {"field": "joinedTable.id", "op": "IS NULL"}
  - Do NOT add a "value" field for IS NULL conditions

EXAMPLES:

"customers from Chennai"
→ { "tables":["customers"], "filters":[{"field":"city","op":"=","value":"Chennai"}], "select":[], "limit":20 }

"get all customers"
→ { "tables":["customers"], "filters":[], "select":[], "limit":20 }

"show all orders"
→ { "tables":["orders"], "filters":[], "select":[], "limit":20 }

"get all item types from orders"
→ { "tables":["orders"], "filters":[], "select":["item"], 
    "distinct":true, "limit":100 }

"total order value for Ravi"
→ { 
      "tables": ["orders", "customers"],
      "filters": [{"field": "customers.name", "op": "=", "value": "Ravi"}],
      "select": [],
      "aggregate": [{"type": "sum", "field": "orders.amount", "alias": "total"}],
      "limit": 1
    }

"customers who never ordered" / "customers with no orders"
→ { 
      "tables": ["customers", "orders"],
      "filters": [
        {"field": "orders.id", "op": "IS NULL"}
      ],
      "select": [],
      "limit": 20
    }

"customers who spent more than 50000 total"
→ {
      "tables": ["customers", "orders"],
      "filters": [],
      "select": [],
      "aggregate": [{"type": "sum", "field": "orders.amount", 
                     "alias": "total_spent"}],
      "groupBy": ["customers.id", "customers.name"],
      "having": [{"field": "total_spent", "op": ">", "value": 50000}],
      "limit": 20
    }

"hello there"
→ { "conversational": true }`;
}
