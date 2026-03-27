import { QueryPlan } from './types';
import { compileQuery, CompiledQuery } from '../execution';
import { validatePlan, ValidationResult } from './index';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface PipelineResult {
  compiled: CompiledQuery;
  originalPlan: QueryPlan; // Add the original validated plan
  attempts: number;
  finalValidation: ValidationResult;
}

export interface LLMAdapter {
  generatePlan(prompt: string): Promise<QueryPlan>;
  correctPlan(originalPrompt: string, feedback: string, badPlan: QueryPlan): Promise<QueryPlan>;
}

// ------------------------------------------------------------------
// Pipeline
// ------------------------------------------------------------------

const MAX_CORRECTION_ATTEMPTS = 3;

export async function buildQueryPipeline(
  userPrompt: string,
  llm: LLMAdapter
): Promise<PipelineResult> {
  let plan = await llm.generatePlan(userPrompt);
  let attempts = 1;

  console.log(`[QueryPipeline] Initial plan:`, JSON.stringify(plan, null, 2));

  while (attempts <= MAX_CORRECTION_ATTEMPTS) {
    const validation = validatePlan(plan);
    console.log(`[QueryPipeline] Validation result:`, validation.valid, validation.issues);

    if (validation.valid) {
      // Check if this is a conversational plan
      if (!plan.needsDb) {
        console.log(`[QueryPipeline] Conversational plan detected, returning as-is`);
        return {
          compiled: { sql: '', params: [] }, // Empty query for conversational
          originalPlan: plan,
          attempts,
          finalValidation: validation,
        };
      }

      // Warnings only — log and proceed
      if (validation.issues.length > 0) {
        console.warn(`[QueryPipeline] Plan has warnings on attempt ${attempts}:`, validation.issues);
      }
      
      const compiled = compileQuery(plan);
      console.log(`[QueryPipeline] Compiled query:`, compiled);
      
      return {
        compiled,
        originalPlan: plan,
        attempts,
        finalValidation: validation,
      };
    }

    // Has errors — ask LLM to self-correct
    if (attempts === MAX_CORRECTION_ATTEMPTS) {
      // Final attempt failed — throw with full context
      throw new QueryPipelineError(
        `Query plan invalid after ${MAX_CORRECTION_ATTEMPTS} attempts.`,
        plan,
        validation
      );
    }

    console.warn(`[QueryPipeline] Attempt ${attempts} failed validation. Requesting correction from LLM.`);
    plan = await llm.correctPlan(userPrompt, validation.llmFeedback!, plan);
    attempts++;
  }

  // Should never reach here
  throw new Error('Unexpected state in query pipeline.');
}

// ------------------------------------------------------------------
// Error type — carries structured context for upstream handling
// ------------------------------------------------------------------

export class QueryPipelineError extends Error {
  constructor(
    message: string,
    public readonly lastPlan: QueryPlan,
    public readonly lastValidation: ValidationResult
  ) {
    super(message);
    this.name = 'QueryPipelineError';
  }
}