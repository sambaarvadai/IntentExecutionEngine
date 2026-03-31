"use strict";
// ------------------------------------------------------------------
// Intent Engine
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentEngine = void 0;
const graphParser_1 = require("./graphParser");
const audit_1 = require("../api/audit");
const store_1 = require("../graph/store");
const graphParser_2 = require("./graphParser");
const promptBuilder_1 = require("./promptBuilder");
const metadata_1 = require("../schema/metadata");
const config_1 = require("../config");
const runtime_1 = require("../graph/runtime");
// ------------------------------------------------------------------
// Intent Engine Class
// ------------------------------------------------------------------
class IntentEngine {
    constructor(anthropic) {
        this.anthropic = anthropic;
    }
    async execute(request) {
        const startTime = Date.now();
        try {
            const schemaMetadata = (0, metadata_1.getSchemaMetadata)();
            const systemPrompt = (0, promptBuilder_1.buildIntentPrompt)(schemaMetadata);
            // Step 1: Generate initial ExecutionGraph
            const messages = [
                { role: 'user', content: request.prompt }
            ];
            let graph;
            let lastRawText = '';
            let correctionAttempts = 0;
            try {
                const result = await this.generateGraph(messages, systemPrompt);
                graph = result.graph;
                lastRawText = result.rawText;
            }
            catch (error) {
                if (error instanceof graphParser_1.IntentParseError) {
                    const correctionResult = await this.correctGraph(messages, error, systemPrompt, schemaMetadata, error.rawText ?? '');
                    graph = correctionResult.graph;
                    correctionAttempts = correctionResult.attempts;
                }
                else {
                    throw error;
                }
            }
            const generationMs = Date.now() - startTime;
            // Step 3: Handle dry run
            if (request.options?.dryRun) {
                const totalMs = generationMs;
                // Log successful dry run execution
                audit_1.intentAuditLog.log({
                    requestId: request.context?.requestId ?? crypto.randomUUID(),
                    timestamp: new Date(),
                    userId: request.context?.user?.id,
                    prompt: request.prompt,
                    graphId: graph.id,
                    nodeCount: graph.nodes.length,
                    generationMs,
                    executionMs: 0,
                    totalMs,
                    status: 'success',
                    correctionAttempts,
                    dryRun: true
                });
                // Save the graph for dry runs
                const stored = await store_1.graphRepository.save({
                    prompt: request.prompt,
                    graph,
                    generationMs,
                    executionMs: 0,
                    success: true
                });
                return {
                    graph,
                    result: {
                        graphId: stored.id,
                        success: true,
                        nodeResults: new Map(),
                        finalOutput: null,
                        totalExecutionTime: 0
                    },
                    generationMs,
                    executionMs: 0,
                    prompt: request.prompt,
                    storedGraphId: stored.id
                };
            }
            // Step 4: Execute the graph
            const executionStartTime = Date.now();
            const runtimeOptions = {
                maxParallelNodes: request.options?.allowParallel ? 5 : 1,
                dryRun: false
            };
            const runtime = new runtime_1.GraphRuntime();
            const result = await runtime.execute(graph, runtimeOptions);
            const executionMs = Date.now() - executionStartTime;
            const totalMs = generationMs + executionMs;
            // Log successful execution
            audit_1.intentAuditLog.log({
                requestId: request.context?.requestId ?? crypto.randomUUID(),
                timestamp: new Date(),
                userId: request.context?.user?.id,
                prompt: request.prompt,
                graphId: graph.id,
                nodeCount: graph.nodes.length,
                generationMs,
                executionMs,
                totalMs,
                status: 'success',
                correctionAttempts,
                dryRun: false
            });
            // Save the executed graph
            const stored = await store_1.graphRepository.save({
                prompt: request.prompt,
                graph,
                generationMs,
                executionMs,
                success: result.success,
                errorMessage: result.success ? undefined :
                    (result.failedNode
                        ? `Failed at node: ${result.failedNode}`
                        : 'Unknown error')
            });
            return {
                graph,
                result,
                generationMs,
                executionMs,
                prompt: request.prompt,
                storedGraphId: stored.id
            };
        }
        catch (error) {
            // Log error execution
            audit_1.intentAuditLog.log({
                requestId: request.context?.requestId ?? crypto.randomUUID(),
                timestamp: new Date(),
                userId: request.context?.user?.id,
                prompt: request.prompt,
                graphId: 'unknown',
                nodeCount: 0,
                generationMs: Date.now() - startTime,
                executionMs: 0,
                totalMs: Date.now() - startTime,
                status: error instanceof graphParser_1.IntentParseError ? 'parse_error' : 'error',
                errorMessage: error instanceof Error ? error.message : String(error),
                correctionAttempts: 0,
                dryRun: request.options?.dryRun ?? false
            });
            throw error; // re-throw after logging
        }
    }
    // ------------------------------------------------------------------
    // Private Helpers
    // ------------------------------------------------------------------
    async generateGraph(messages, systemPrompt) {
        const config = (0, config_1.getConfig)();
        const response = await this.anthropic.messages.create({
            model: config.llm.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages
        });
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Anthropic API');
        }
        const rawText = content.text.trim();
        // Extract JSON from markdown fences if present (robust parsing like interpret.ts)
        let jsonText = rawText;
        if (rawText.startsWith('```json')) {
            jsonText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        else if (rawText.startsWith('```')) {
            jsonText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        // Parse response text as JSON
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        }
        catch (error) {
            throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Parse and validate the graph
        try {
            const graph = (0, graphParser_2.parseIntentGraph)(parsed);
            return { graph, rawText };
        }
        catch (err) {
            if (err instanceof graphParser_1.IntentParseError) {
                throw new graphParser_1.IntentParseError(err.message, err.details, rawText);
            }
            throw err;
        }
    }
    async correctGraph(messages, initialError, systemPrompt, schemaMetadata, initialRawText) {
        const MAX_CORRECTION_ATTEMPTS = 3;
        let attempts = 0;
        let currentError = initialError;
        let currentRawText = initialRawText;
        // Start with the original messages
        let correctedMessages = [...messages];
        while (attempts < MAX_CORRECTION_ATTEMPTS) {
            attempts++;
            // Add the assistant's previous bad response to provide context (if we have one)
            if (currentRawText) {
                correctedMessages.push({
                    role: 'assistant',
                    content: currentRawText
                });
            }
            // Create correction message with full error details for high-fidelity self-correction
            const details = currentError.details;
            const llmFeedback = details?.llmFeedback;
            const correctionMessage = llmFeedback
                ? `The previous ExecutionGraph had an invalid QueryPlan in node "${details.nodeId}". Please correct it and return ONLY the corrected JSON ExecutionGraph.

${llmFeedback}

Return ONLY the corrected JSON ExecutionGraph with no explanations or markdown fences.`
                : `The previous ExecutionGraph had parsing errors. Please correct them and return ONLY the corrected JSON ExecutionGraph.

Error Details:
${JSON.stringify(currentError.details, null, 2)}

Return ONLY the corrected JSON ExecutionGraph with no explanations or markdown fences.`;
            correctedMessages.push({
                role: 'user',
                content: correctionMessage
            });
            try {
                const result = await this.generateGraph(correctedMessages, systemPrompt);
                return { graph: result.graph, attempts }; // Success - no parsing errors
            }
            catch (parseError) {
                if (parseError instanceof graphParser_1.IntentParseError) {
                    currentError = parseError; // Update error with new details
                    currentRawText = parseError.rawText ?? ''; // Read rawText from error
                    continue; // Try again
                }
                else {
                    throw parseError; // Different error, re-throw
                }
            }
        }
        // All attempts failed
        throw new graphParser_1.IntentParseError(`Failed to generate valid ExecutionGraph after ${MAX_CORRECTION_ATTEMPTS} correction attempts`, { attempts: MAX_CORRECTION_ATTEMPTS, lastError: currentError });
    }
}
exports.IntentEngine = IntentEngine;
//# sourceMappingURL=engine.js.map