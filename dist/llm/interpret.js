"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMInterpreterError = void 0;
exports.interpretUserRequest = interpretUserRequest;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../config");
const prompts_1 = require("./prompts");
class LLMInterpreterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LLMInterpreterError';
    }
}
exports.LLMInterpreterError = LLMInterpreterError;
async function interpretUserRequest(userMessage) {
    const config = (0, config_1.getConfig)();
    if (config.app.debug) {
        console.log('Debug: ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
        console.log('Debug: ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY?.length);
        console.log('Debug: ANTHROPIC_API_KEY starts with sk-ant:', process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant'));
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new LLMInterpreterError('ANTHROPIC_API_KEY environment variable is not set');
    }
    // Initialize Anthropic client inside the function
    if (config.app.debug) {
        console.log('Debug: Creating Anthropic client...');
    }
    const anthropic = new sdk_1.default({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    if (config.app.debug) {
        console.log('Debug: Anthropic client created successfully');
    }
    const systemPrompt = (0, prompts_1.getFullSystemPrompt)();
    try {
        const response = await anthropic.messages.create({
            model: config.llm.model,
            max_tokens: config.llm.maxTokens,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ]
        });
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new LLMInterpreterError('Unexpected response type from Anthropic API');
        }
        // Extract JSON from the response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new LLMInterpreterError('No JSON found in LLM response');
        }
        const plan = JSON.parse(jsonMatch[0]);
        return plan;
    }
    catch (error) {
        if (error instanceof LLMInterpreterError) {
            throw error;
        }
        throw new LLMInterpreterError(`Failed to interpret user request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=interpret.js.map