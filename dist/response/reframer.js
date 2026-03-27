"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reframeResponse = reframeResponse;
const config_1 = require("../config");
async function reframeResponse(originalQuery, queryResult, sql) {
    const config = (0, config_1.getConfig)();
    if (!config.pipeline.enableResponseReframing) {
        // Return original formatted response if reframing is disabled
        return typeof queryResult === 'string' ? queryResult : formatBasicResponse(queryResult);
    }
    try {
        const Anthropic = (await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')))).default;
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
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
    }
    catch (error) {
        console.warn('Response reframing failed:', error);
        // Fallback to basic response
        return typeof queryResult === 'string' ? queryResult : formatBasicResponse(queryResult);
    }
}
function formatDataForLLM(queryResult) {
    if (!queryResult.rows || queryResult.rows.length === 0) {
        return 'No results found.';
    }
    const headers = queryResult.fields || Object.keys(queryResult.rows[0]);
    const rows = queryResult.rows.map(row => headers.map(header => `${header}: ${row[header]}`).join(', ')).join('\n');
    return `Results (${queryResult.rows.length} rows):
${headers.join(' | ')}
${rows}`;
}
function formatBasicResponse(queryResult) {
    // This is a simplified version - the actual formatting happens in formatResponse
    return `${queryResult.rows?.length || 0} results found.`;
}
//# sourceMappingURL=reframer.js.map