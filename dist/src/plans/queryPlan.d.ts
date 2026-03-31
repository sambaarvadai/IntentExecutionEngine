import { QueryPlan } from './types';
import { CompiledQuery } from '../execution';
import { ValidationResult } from './index';
export interface PipelineResult {
    compiled: CompiledQuery;
    originalPlan: QueryPlan;
    attempts: number;
    finalValidation: ValidationResult;
}
export interface LLMAdapter {
    generatePlan(prompt: string): Promise<QueryPlan>;
    correctPlan(originalPrompt: string, feedback: string, badPlan: QueryPlan): Promise<QueryPlan>;
}
export declare function buildQueryPipeline(userPrompt: string, llm: LLMAdapter): Promise<PipelineResult>;
export declare class QueryPipelineError extends Error {
    readonly lastPlan: QueryPlan;
    readonly lastValidation: ValidationResult;
    constructor(message: string, lastPlan: QueryPlan, lastValidation: ValidationResult);
}
//# sourceMappingURL=queryPlan.d.ts.map