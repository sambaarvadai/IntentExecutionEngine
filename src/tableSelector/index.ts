import { Anthropic } from '@anthropic-ai/sdk';
import { SchemaContext } from './schemaSlice';
import { TurnRecord } from '../session/types';
import { createSchemaContext, sliceSchema } from './schemaSlice';
import { getConfig } from '../config';

export { createSchemaContext, sliceSchema };

export interface TableSelectorOptions {
  maxTables?: number;
}

export async function selectRelevantTables(
  query: string,
  schema: SchemaContext,
  sessionContext: TurnRecord[],
  anthropic: Anthropic,
  opts?: TableSelectorOptions
): Promise<string[]> {
  const maxTables = opts?.maxTables ?? 6;
  const config = getConfig();
  const model = config.llm.tableSelectorModel || 'claude-3-haiku-20240307';
  
  // Build compact schema digest
  const schemaDigest = buildSchemaDigest(schema);
  
  // Format session context
  const sessionDigest = formatSessionContext(sessionContext);
  
  // Build Haiku prompt
  const systemPrompt = `You are a table selector for a SQL query engine.
Given a natural language query and a compact schema digest, return ONLY a JSON array
of table names that are needed to answer the query.

Rules:
- Include every table directly referenced or implied by the query.
- If two tables are needed and a bridge/junction table connects them, include the bridge table.
- Never include tables that are irrelevant to the query.
- If session context references a table from a prior turn, include it only if still relevant.
- Return ONLY valid JSON. No explanation. Example: ["customers","orders"]`;

  const userPrompt = `Session context (last N turns):
${sessionDigest}

Current query: "${query}"

Schema digest:
${schemaDigest}`;

  try {
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 1000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Haiku');
    }

    // Parse and validate response - handle markdown code blocks
    let responseText = content.text.trim();
    
    // Remove markdown code block wrapper if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace('```json', '').replace('```', '').trim();
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace('```', '').trim();
    }
    
    const selectedTables = JSON.parse(responseText);
    
    if (!Array.isArray(selectedTables)) {
      throw new Error('Haiku returned non-array response');
    }

    // Validate table names exist in schema
    const validTables = selectedTables.filter(table => 
      schema.tables.hasOwnProperty(table)
    );

    // Apply maxTables limit
    const limitedTables = validTables.slice(0, maxTables);
    
    // If no tables selected or all filtered out, fall back to all tables
    if (limitedTables.length === 0) {
      return Object.keys(schema.tables).slice(0, maxTables);
    }

    return limitedTables;

  } catch (error) {
    console.warn('[TABLE_SELECTOR] Haiku selection failed, falling back to all tables:', error);
    // Fail-open: return all tables (limited by maxTables)
    return Object.keys(schema.tables).slice(0, maxTables);
  }
}

function buildSchemaDigest(schema: SchemaContext): string {
  const digest: string[] = [];
  
  // Add tables with descriptions and columns
  for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
    const description = tableInfo.description ? ` - ${tableInfo.description}` : '';
    const columns = Object.keys(tableInfo.columns).join(', ');
    digest.push(`${tableName}${description}\nColumns: ${columns}`);
  }
  
  // Add foreign key relationships
  if (schema.foreignKeys && schema.foreignKeys.length > 0) {
    digest.push('\nForeign keys:');
    for (const fk of schema.foreignKeys) {
      digest.push(`${fk.fromColumn} → ${fk.toColumn}`);
    }
  }
  
  return digest.join('\n\n');
}

function formatSessionContext(sessionContext: TurnRecord[]): string {
  if (sessionContext.length === 0) {
    return '(no prior context)';
  }
  
  return sessionContext
    .slice(-5) // Last 5 turns
    .map(turn => `- Query: "${turn.rawQuery}" | Tables: ${turn.intent.tables.join(', ')}`)
    .join('\n');
}
