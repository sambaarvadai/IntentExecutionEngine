import Anthropic from '@anthropic-ai/sdk';
import { AnyPlan } from '../plans/types';
import { getConfig } from '../config';
import { getFullSystemPrompt } from './prompts';

export class LLMInterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMInterpreterError';
  }
}

export async function interpretUserRequest(userMessage: string): Promise<AnyPlan> {
  const config = getConfig();
  
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
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  if (config.app.debug) {
    console.log('Debug: Anthropic client created successfully');
  }

  const systemPrompt = getFullSystemPrompt();

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
    return plan as AnyPlan;

  } catch (error) {
    if (error instanceof LLMInterpreterError) {
      throw error;
    }
    throw new LLMInterpreterError(`Failed to interpret user request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
