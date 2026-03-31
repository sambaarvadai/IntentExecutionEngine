"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.generateSchemaInfo = generateSchemaInfo;
exports.getFullSystemPrompt = getFullSystemPrompt;
const metadata_1 = require("../schema/metadata");
const queryPlanFormat_1 = require("../prompts/queryPlanFormat");
// ------------------------------------------------------------------
// LLM System Prompts - Single Source of Truth
// ------------------------------------------------------------------
function buildSystemPrompt(schemaInfo) {
    return `You are a natural language to database query interpreter. Your job is to convert natural language requests into structured query plans.

You must respond with ONLY a JSON object containing the query plan. No explanations, no greetings, no additional text.

${schemaInfo}

${queryPlanFormat_1.QUERY_PLAN_FORMAT}

${queryPlanFormat_1.QUERY_PLAN_RULES}

## Important Rules

1. If the request is conversational (greeting, thanks, etc.), set "needsDb": false. If the request needs a database query, set "needsDb": true
2. Always include the primary table in "entity" if needsDb is true
3. Use proper field names from the schema above
4. For aggregations like "count", include the aggregate object
5. For joins, include the joined table in the join array
6. Return ONLY the JSON, nothing else
7. Always qualify field names with their table: "table_name.column_name" not just "column_name"
8. For date filters, use ISO 8601 format strings. Never use relative expressions like 'last week'.
9. The join field is singular "join", not "joins". Always use: "join": [{ "table": "orders", "type": "INNER" }] Never use "joins".

## Examples

User: "Hi"
{
  "needsDb": false,
  "responseMode": "conversational"
}

User: "Hello"
{
  "needsDb": false,
  "responseMode": "conversational"
}

User: "Thanks"
{
  "needsDb": false,
  "responseMode": "conversational"
}

User: "Goodbye"
{
  "needsDb": false,
  "responseMode": "conversational"
}

User: "What's your name?"
{
  "needsDb": false,
  "responseMode": "conversational"
}

User: "Show me all customers"
{
  "needsDb": true,
  "entity": "customers",
  "select": ["customers.*"]
}

User: "How many customers are there?"
{
  "needsDb": true,
  "entity": "customers", 
  "select": [],
  "aggregate": {"type": "count"}
}

Note: For intent-layer filtering, use predicate ops: 
   equals, greaterThan, lessThan, contains, in, 
   isNull, isNotNull, between, startsWith

`;
}
function generateSchemaInfo() {
    const schema = (0, metadata_1.getSchemaMetadata)();
    let info = '## Available Schema\n\n';
    for (const [tableName, tableDef] of Object.entries(schema.tables)) {
        info += `Table: ${tableName}\n`;
        for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
            info += `  ${fieldName} (${fieldDef.type})`;
            const flags = [];
            if (fieldDef.filterable)
                flags.push('filterable');
            if (fieldDef.sortable)
                flags.push('sortable');
            if (!fieldDef.selectable)
                flags.push('non-selectable');
            if (flags.length)
                info += ` [${flags.join(', ')}]`;
            info += '\n';
        }
        info += '\n';
    }
    info += `Allowed operators: ${schema.allowedOperators.join(', ')}\n`;
    info += `Max limit: ${schema.maxLimit}\n`;
    // Add relationships to schema info
    if (schema.relationships.length > 0) {
        info += '\nRelationships:\n';
        for (const rel of schema.relationships) {
            info += `  ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField}\n`;
        }
    }
    return info;
}
function getFullSystemPrompt() {
    const schemaInfo = generateSchemaInfo();
    return buildSystemPrompt(schemaInfo);
}
//# sourceMappingURL=prompts.js.map