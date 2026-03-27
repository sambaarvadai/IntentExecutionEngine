import { AnyPlan } from './types';
import { interpretUserRequest } from '../llm';
import { getSchemaMetadata } from '../schema/metadata';
import { getConfig } from '../config';
import { LLMAdapter } from './queryPlan';
import { getFullSystemPrompt } from '../llm/prompts';

export class AnthropicAdapter implements LLMAdapter {
  async generatePlan(prompt: string): Promise<AnyPlan> {
    return await interpretUserRequest(prompt);
  }

  async correctPlan(originalPrompt: string, feedback: string, badPlan: AnyPlan): Promise<AnyPlan> {
    // Create a correction prompt using validation feedback
    const correctionPrompt = `You are correcting a previously generated query plan. This is NOT a new user request - it's a correction task.

The original user request was: "${originalPrompt}"

The previous plan had these issues:
${feedback}

Please generate a corrected JSON query plan that addresses all the issues above. Return ONLY corrected JSON query plan - no explanations. This is a correction task, not a new user request.

Previous invalid plan:
${JSON.stringify(badPlan, null, 2)}`;

    // Bypass conversational logic by calling internal functions directly
    // We need to access internal Anthropic client and system prompt
    const schemaMetadata = getSchemaMetadata();
    const config = getConfig();
    
    // Use centralized system prompt
    const systemPrompt = getFullSystemPrompt();

    // Call Anthropic directly with correction prompt
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: correctionPrompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic API');
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const plan = JSON.parse(jsonMatch[0]);
    return plan as AnyPlan;
  }
}
