// ------------------------------------------------------------------
// Intent Engine
// ------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages';

import { 
  IntentRequest, 
  IntentResult
} from './types';

import { 
  IntentParseError 
} from './graphParser';

import { 
  intentAuditLog 
} from '../api/audit';

import { 
  ExecutionGraph, 
  GraphResult,
  GraphRuntimeOptions 
} from '../graph/types';

import { 
  graphRepository 
} from '../graph/store';

import { 
  parseIntentGraph 
} from './graphParser';

import { 
  buildIntentPrompt 
} from './promptBuilder';

import { 
  getSchemaMetadata 
} from '../schema/metadata';

import { 
  getConfig 
} from '../config';

import { 
  GraphRuntime 
} from '../graph/runtime';

// ------------------------------------------------------------------
// Intent Engine Class
// ------------------------------------------------------------------

export class IntentEngine {
  constructor(
    private anthropic: Anthropic
  ) {}

  async execute(request: IntentRequest): Promise<IntentResult> {
    const startTime = Date.now();
    
    try {
      const schemaMetadata = getSchemaMetadata();
      const systemPrompt = buildIntentPrompt(schemaMetadata);

      // Step 1: Generate initial ExecutionGraph
      const messages: MessageParam[] = [
        { role: 'user', content: request.prompt }
      ];

      let graph: ExecutionGraph;
      let lastRawText: string = '';
      let correctionAttempts = 0;
      
      try {
        const result = await this.generateGraph(messages, systemPrompt);
        graph = result.graph;
        lastRawText = result.rawText;
      } catch (error) {
        if (error instanceof IntentParseError) {
          const correctionResult = await this.correctGraph(messages, error, systemPrompt, schemaMetadata, error.rawText ?? '');
          graph = correctionResult.graph;
          correctionAttempts = correctionResult.attempts;
        } else {
          throw error;
        }
      }

      const generationMs = Date.now() - startTime;

      // Step 3: Handle dry run
      if (request.options?.dryRun) {
        const totalMs = generationMs;
        
        // Log successful dry run execution
        intentAuditLog.log({
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
        const stored = await graphRepository.save({
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
      const runtimeOptions: GraphRuntimeOptions = {
        maxParallelNodes: request.options?.allowParallel ? 5 : 1,
        dryRun: false
      };

      const runtime = new GraphRuntime();
      const result = await runtime.execute(graph, runtimeOptions);
      const executionMs = Date.now() - executionStartTime;
      const totalMs = generationMs + executionMs;

      // Log successful execution
      intentAuditLog.log({
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
      const stored = await graphRepository.save({
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
    } catch (error) {
      // Log error execution
      intentAuditLog.log({
        requestId: request.context?.requestId ?? crypto.randomUUID(),
        timestamp: new Date(),
        userId: request.context?.user?.id,
        prompt: request.prompt,
        graphId: 'unknown',
        nodeCount: 0,
        generationMs: Date.now() - startTime,
        executionMs: 0,
        totalMs: Date.now() - startTime,
        status: error instanceof IntentParseError ? 'parse_error' : 'error',
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

  private async generateGraph(messages: MessageParam[], systemPrompt: string): Promise<{ graph: ExecutionGraph, rawText: string }> {
    const config = getConfig();
    
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
    } else if (rawText.startsWith('```')) {
      jsonText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse response text as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Parse and validate the graph
    try {
      const graph = parseIntentGraph(parsed);
      return { graph, rawText };
    } catch (err) {
      if (err instanceof IntentParseError) {
        throw new IntentParseError(err.message, err.details, rawText);
      }
      throw err;
    }
  }

  private async correctGraph(
    messages: MessageParam[], 
    initialError: IntentParseError, 
    systemPrompt: string,
    schemaMetadata: ReturnType<typeof getSchemaMetadata>,
    initialRawText: string
  ): Promise<{ graph: ExecutionGraph, attempts: number }> {
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
      const details = currentError.details as any;
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
      } catch (parseError) {
        if (parseError instanceof IntentParseError) {
          currentError = parseError; // Update error with new details
          currentRawText = parseError.rawText ?? ''; // Read rawText from error
          continue; // Try again
        } else {
          throw parseError; // Different error, re-throw
        }
      }
    }

    // All attempts failed
    throw new IntentParseError(`Failed to generate valid ExecutionGraph after ${MAX_CORRECTION_ATTEMPTS} correction attempts`, { attempts: MAX_CORRECTION_ATTEMPTS, lastError: currentError });
  }
}
