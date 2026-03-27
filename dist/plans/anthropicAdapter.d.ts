import { AnyPlan } from './types';
import { LLMAdapter } from './queryPlan';
export declare class AnthropicAdapter implements LLMAdapter {
    generatePlan(prompt: string): Promise<AnyPlan>;
    correctPlan(originalPrompt: string, feedback: string, badPlan: AnyPlan): Promise<AnyPlan>;
}
//# sourceMappingURL=anthropicAdapter.d.ts.map