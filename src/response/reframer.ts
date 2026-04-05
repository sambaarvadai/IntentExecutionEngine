import { getConfig } from '../config';
import { QueryResult } from '../plans/types';
import { GraphResult } from '../graph/types';

// Helper function to recursively search for error messages in nested objects
function findErrorMessage(obj: any): string | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  
  // Check if current object has an error property
  if (obj.error && typeof obj.error === 'string') {
    return obj.error;
  }
  
  // Handle Map objects (like nodeResults)
  if (obj instanceof Map) {
    for (const [key, value] of obj.entries()) {
      const error = findErrorMessage(value);
      if (error) return error;
    }
    return null;
  }
  
  // Search recursively in object properties and arrays
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string' && key.toLowerCase().includes('error')) {
        return value;
      }
      
      if (Array.isArray(value)) {
        for (const item of value) {
          const error = findErrorMessage(item);
          if (error) return error;
        }
      } else if (typeof value === 'object') {
        const error = findErrorMessage(value);
        if (error) return error;
      }
    }
  }
  
  return null;
}

export async function reframeResponse(
  originalQuery: string,
  queryResult: QueryResult | string | GraphResult | { success: boolean; error: string },
  sql?: string,
  error?: Error | string
): Promise<string> {
  const config = getConfig();
  
  if (!config.pipeline.enableResponseReframing) {
    // Return original formatted response if reframing is disabled
    if (typeof queryResult === 'string') {
      return queryResult;
    } else if ('rows' in queryResult) {
      return formatBasicResponse(queryResult as QueryResult);
    } else {
      // For GraphResult or error objects, return a basic string representation
      return JSON.stringify(queryResult, null, 2);
    }
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Prepare context for the LLM
    let dataContext: string;
    let actualError = error;
    
    // If no explicit error provided, try to find one in the queryResult
    if (!actualError && typeof queryResult === 'object' && queryResult !== null) {
      const foundError = findErrorMessage(queryResult);
      if (foundError) {
        actualError = foundError;
      }
    }
    
    if (actualError) {
      // Handle error context
      const errorMessage = actualError instanceof Error ? actualError.message : actualError;
      dataContext = `Error occurred: ${errorMessage}`;
      
      if (sql) {
        dataContext += `\nSQL Query that failed: ${sql}`;
      }
    } else {
      // Handle normal query results
      if (typeof queryResult === 'string') {
        dataContext = `Response: ${queryResult}`;
      } else if ('rows' in queryResult) {
        dataContext = formatDataForLLM(queryResult as QueryResult);
      } else {
        // For GraphResult or other objects, convert to string
        dataContext = `Result: ${JSON.stringify(queryResult, null, 2)}`;
      }
    }

    const systemPrompt = actualError 
    ? `You are a helpful database assistant. The user's question resulted in an error. Your job is to:
1. Explain what went wrong in simple, user-friendly terms
2. Suggest how the user might fix their query
3. Be empathetic and helpful
4. Don't use technical jargon unless necessary
5. If it's a syntax error, suggest the correct format
6. If it's a data issue, explain what might be missing

Guidelines for error responses:
- Acknowledge the problem clearly
- Explain what the error means in plain English
- Provide specific suggestions to fix it
- Stay positive and helpful
- Don't show raw error messages to the user`
    : `You are a helpful database assistant. Take the user's question and the database query results, then provide a natural, conversational response.

Guidelines:
- Be friendly and conversational
- Summarize key insights from the data
- Use natural language instead of technical terms
- If there's no data, explain what that means
- Keep responses concise but informative
- Don't mention SQL or technical details
- Focus on answering the user's original question`;

    const userPrompt = actualError
    ? `User Question: "${originalQuery}"

${dataContext}

Please provide a helpful, user-friendly response that explains what went wrong and how the user might fix their query.`
    : `User Question: "${originalQuery}"

Database Query Results:
${dataContext}

${sql ? `SQL Query: ${sql}` : ''}

Please provide a natural, conversational response to the user's question based on these results.`;

    const response = await anthropic.messages.create({
      model: config.llm.summaryModel,
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
    if (typeof queryResult === 'string') {
      return queryResult;
    } else if ('rows' in queryResult) {
      return formatBasicResponse(queryResult as QueryResult);
    } else {
      // For GraphResult or other objects, return a basic string representation
      return JSON.stringify(queryResult, null, 2);
    }
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
