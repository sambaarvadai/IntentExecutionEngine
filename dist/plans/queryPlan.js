"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryPipelineError = void 0;
exports.buildQueryPipeline = buildQueryPipeline;
const execution_1 = require("../execution");
const index_1 = require("./index");
// ------------------------------------------------------------------
// Pipeline
// ------------------------------------------------------------------
const MAX_CORRECTION_ATTEMPTS = 3;
async function buildQueryPipeline(userPrompt, llm) {
    let plan = await llm.generatePlan(userPrompt);
    let attempts = 1;
    console.log(`[QueryPipeline] Initial plan:`, JSON.stringify(plan, null, 2));
    while (attempts <= MAX_CORRECTION_ATTEMPTS) {
        const validation = (0, index_1.validatePlan)(plan);
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
            const compiled = (0, execution_1.compileQuery)(plan);
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
            throw new QueryPipelineError(`Query plan invalid after ${MAX_CORRECTION_ATTEMPTS} attempts.`, plan, validation);
        }
        console.warn(`[QueryPipeline] Attempt ${attempts} failed validation. Requesting correction from LLM.`);
        plan = await llm.correctPlan(userPrompt, validation.llmFeedback, plan);
        attempts++;
    }
    // Should never reach here
    throw new Error('Unexpected state in query pipeline.');
}
// ------------------------------------------------------------------
// Error type — carries structured context for upstream handling
// ------------------------------------------------------------------
class QueryPipelineError extends Error {
    constructor(message, lastPlan, lastValidation) {
        super(message);
        this.lastPlan = lastPlan;
        this.lastValidation = lastValidation;
        this.name = 'QueryPipelineError';
    }
}
exports.QueryPipelineError = QueryPipelineError;
//# sourceMappingURL=queryPlan.js.map