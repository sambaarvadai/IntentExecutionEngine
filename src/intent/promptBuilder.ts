// ------------------------------------------------------------------
// Intent Prompt Builder
// ------------------------------------------------------------------

import { SchemaMetadata } from '../schema/metadata';
import { SessionContext } from '../session/types';

export function buildIntentPrompt(
  schema: SchemaMetadata,
  session?: SessionContext
): string {
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
  "conversational": boolean,
  "conversationalResponse": string  // only when conversational: true
}

FILTER OPERATORS:
"op": "=" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | 
      "LIKE" | "IS NULL" | "IS NOT NULL" | "BETWEEN"

RULES:
- Never specify join conditions — they are inferred from schema
- For temporal filters use ISO date strings
- For "last N years/months/days" compute from today: ${today}
- tables[] order matters: primary table first, joined tables after
- If query is a greeting, thanks, or casual conversation,
    set conversational: true and populate conversationalResponse
    with a brief, friendly reply (1-2 sentences max)

MULTIPLE VALUES ON SAME FIELD:
- When matching one field against multiple possible values,
  always use IN — never multiple LIKE or = conditions
- Use LIKE only for a single partial match on one value
- Use OR logic only when filtering different fields
- If the user provides a list, or context contains a list
  of values for the same column, always collapse to IN

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

${session?.turns.length ? `
SESSION CONTEXT (recent conversation):
${session.turns.slice(-3).map((turn, i) => `
Turn ${i + 1}: "${turn.rawQuery}"
→ ${turn.intentSummary.action} ${turn.intentSummary.subject}
${turn.intentSummary.filters?.length ? `  Filters: ${turn.intentSummary.filters.join(', ')}` : ''}
${turn.intentSummary.metric ? `  Metric: ${turn.intentSummary.metric}` : ''}
Result: ${turn.resultShape.rowCount} rows from ${turn.resultShape.primaryTable}
${turn.resultShape.primaryKeyValues.length > 0 ? `  IDs: [${turn.resultShape.primaryKeyValues.slice(0,10).join(', ')}]` : ''}
`).join('')}

PRONOUN RESOLUTION RULES:
- "those", "them", "they", "those customers/orders" → 
  use the IDs from the most recent turn:
  filter: { field: "${session.turns[session.turns.length - 1]?.resultShape.primaryTable}.id", 
            op: "IN", value: [${session.turns[session.turns.length - 1]?.resultShape.primaryKeyValues.join(',')}] }
  If the last turn shows "too many to list individually", first ask user to narrow down with filters before using pronouns.
- "same filter", "also", "as well" → inherit filters from last turn
- "now add", "but also", "and" → extend last turn's intent
- "instead", "change to", "actually" → replace a specific part

TERM INHERITANCE:
If a prior turn used a vague term and a later turn gave it 
a precise meaning, use that precise meaning going forward.

Example in session:
  Turn 1: "high value customers" → HAVING total_spent > 10000
  Turn 2: "customers who spent more than 30000" → 
           HAVING total_spent > 30000 (this redefines "high value")
  Turn 3: "high value customers from Chennai" → 
           MUST use HAVING total_spent > 30000 (from turn 2)
           AND add WHERE customers.city = 'Chennai'

CONDITION INHERITANCE:
When a query refines a prior query, inherit all prior conditions
unless explicitly replaced:
- Adding a filter: keep all prior conditions + add new one
- "only from Chennai" after a HAVING query → keep HAVING + add city
- "make it 50000 instead" → replace just the threshold value
- "remove the city filter" → drop only that condition
` : ''}

${session?.userDefinedTerms && Object.keys(session.userDefinedTerms).length ? `
USER-DEFINED TERMS (use these when the term appears in queries):
${Object.entries(session.userDefinedTerms).map(([term, def]) =>
  `  "${term}" means: ${def.description}`
).join('\n')}
` : ''}

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
→ { "conversational": true, "conversationalResponse": "Hello! How can I help you today?" }`;
}
