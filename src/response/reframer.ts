import { getConfig } from '../config';
import { QueryResult } from '../plans/types';

export async function reframeResponse(
  originalQuery: string,
  queryResult: QueryResult | string,
  sql?: string
): Promise<string> {
  const config = getConfig();
  
  if (!config.pipeline.enableResponseReframing) {
    // Return original formatted response if reframing is disabled
    return typeof queryResult === 'string' ? queryResult : formatBasicResponse(queryResult);
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Prepare context for the LLM
    const dataContext = typeof queryResult === 'string' 
      ? `Response: ${queryResult}`
      : formatDataForLLM(queryResult);

    const systemPrompt = `You are a helpful database assistant. Take the user's question and the database query results, then provide a natural, conversational response.

Guidelines:
- Be friendly and conversational
- Summarize key insights from the data
- Use natural language instead of technical terms
- If there's no data, explain what that means
- Keep responses concise but informative
- Don't mention SQL or technical details
- Focus on answering the user's original question`;

    const userPrompt = `User Question: "${originalQuery}"

Database Query Results:
${dataContext}

${sql ? `SQL Query: ${sql}` : ''}

Please provide a natural, conversational response to the user's question based on these results.`;

    const response = await anthropic.messages.create({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic API');
    }

    return content.text.trim();

  } catch (error) {
    console.warn('Response reframing failed:', error);
    // Fallback to basic response
    return typeof queryResult === 'string' ? queryResult : formatBasicResponse(queryResult);
  }
}

function formatDataForLLM(queryResult: QueryResult): string {
  if (!queryResult.rows || queryResult.rows.length === 0) {
    return 'No results found.';
  }

  const headers = queryResult.fields || Object.keys(queryResult.rows[0]);
  const rows = queryResult.rows.map(row => 
    headers.map(header => `${header}: ${row[header]}`).join(', ')
  ).join('\n');

  return `Results (${queryResult.rows.length} rows):
${headers.join(' | ')}
${rows}`;
}

function formatBasicResponse(queryResult: QueryResult): string {
  // This is a simplified version - the actual formatting happens in formatResponse
  return `${queryResult.rows?.length || 0} results found.`;
}
