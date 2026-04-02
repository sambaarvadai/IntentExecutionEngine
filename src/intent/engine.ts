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
  QueryIntent 
} from './intentTypes';

import { 
  compileIntent 
} from './intentCompiler';

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
  SessionStore 
} from '../session/store';

import { 
  TurnRecord 
} from '../session/types';

import { 
  createBlankSession 
} from '../session/store';

import { 
  formatSummary 
} from './intentCompiler';

import { 
  getConfig 
} from '../config';

import { 
  GraphRuntime 
} from '../graph/runtime';

import { APISearchService } from '../search';

// ------------------------------------------------------------------
// Intent Engine Class
// ------------------------------------------------------------------

export class IntentEngine {
  constructor(
    private anthropic: Anthropic,
    private sessionStore?: SessionStore,
    private searchService?: APISearchService
  ) {}

  async execute(request: IntentRequest): Promise<IntentResult> {
    const startTime = Date.now();
    
    try {
      // Load session if sessionId provided
      let session: any;
      if (request.sessionId && this.sessionStore) {
        session = await this.sessionStore.get(request.sessionId) 
                  ?? createBlankSession(request.sessionId);
      }

      // Cache check — skip if no search service configured
      if (this.searchService) {
        console.log('[CACHE] Checking cache for:', request.prompt);
        const cacheResult = await this.searchService.checkCache(
          request.prompt
        );
        
        console.log('[CACHE] Result:', JSON.stringify({
          hit: cacheResult.hit,
          score: cacheResult.match?.score,
          apiId: cacheResult.match?.apiId
        }));
        
        if (cacheResult.hit && cacheResult.match) {
          const api = cacheResult.match.api;
          const graph = (api as any).executionGraph as ExecutionGraph;
          
          console.log(`[CACHE] HIT — score: ${cacheResult.match.score.toFixed(3)}`);

          // Generate summary for the cached graph if missing
          if (!graph.intentSummary?.plainText && session) {
            // Use existing summary from graph or generate minimal one
            graph.intentSummary = graph.intentSummary ?? {
              action: '', subject: '', 
              plainText: `Cached result for: ${request.prompt}` 
            };
          }

          // Save graph to repository so it has a storedGraphId for execution
          const stored = await graphRepository.save({
            prompt: request.prompt,
            graph,
            generationMs: 0,
            executionMs: 0,
            success: true
          });

          // Preview mode — return summary without executing
          if (request.options?.preview) {
            return {
              graph,
              result: {
                graphId: stored.id, success: true,
                nodeResults: new Map(), finalOutput: null,
                totalExecutionTime: 0
              },
              generationMs: 0,
              executionMs: 0,
              prompt: request.prompt,
              storedGraphId: stored.id,
              status: 'preview',
              intentSummary: graph.intentSummary,
              formattedSummary: formatSummary(graph.intentSummary),
              cacheHit: true,
              cacheScore: cacheResult.match.score
            };
          }

          // Execute confirmed cached graph
          const executionStart = Date.now();
          const runtime = new GraphRuntime();
          const result = await runtime.execute(graph, {
            maxParallelNodes: request.options?.allowParallel ? 5 : 1,
            dryRun: false
          });
          const executionMs = Date.now() - executionStart;

          // Record turn in session — same as normal path
          if (request.sessionId && this.sessionStore && result.success) {
            const rows = extractRows(result.finalOutput);
            const queryPlan = graph.nodes[0]?.plan;
            const turn = {
              turnId: crypto.randomUUID(),
              timestamp: Date.now(),
              rawQuery: request.prompt,
              intentSummary: graph.intentSummary!,
              intent: {
                tables: queryPlan?.entity ? [queryPlan.entity] : [],
                filters: queryPlan?.where ?? [],
                aggregate: queryPlan?.aggregate 
                  ? (Array.isArray(queryPlan.aggregate) 
                      ? queryPlan.aggregate 
                      : [queryPlan.aggregate]) 
                  : undefined,
                groupBy: queryPlan?.groupBy,
                having: queryPlan?.having,
                orderBy: queryPlan?.orderBy 
                  ? (Array.isArray(queryPlan.orderBy) 
                      ? queryPlan.orderBy 
                      : [queryPlan.orderBy]) 
                  : undefined,
                distinct: queryPlan?.distinct,
                limit: queryPlan?.limit
              },
              resultShape: {
                rowCount: rows.length,
                columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                primaryTable: queryPlan?.entity ?? '',
                primaryKeyValues: rows
                  .map((r: any) => r['id'])
                  .filter(Boolean)
                  .slice(0, 100),
                sampleRows: rows.slice(0, 3)
              }
            };
            await this.sessionStore.appendTurn(request.sessionId, turn);
          }

          return {
            graph,
            result,
            generationMs: 0,
            executionMs,
            prompt: request.prompt,
            storedGraphId: stored.id,
            status: 'success',
            cacheHit: true,
            cacheScore: cacheResult.match.score
          };
        }
      }

      // Cache miss — continue with normal generation flow
      const schemaMetadata = getSchemaMetadata();
      const systemPrompt = buildIntentPrompt(schemaMetadata, session);

      // Step 1: Generate initial ExecutionGraph
      const messages: MessageParam[] = [
        { role: 'user', content: request.prompt }
      ];

      let graph: ExecutionGraph;
      let lastRawText: string = '';
      let correctionAttempts = 0;
      let intent: QueryIntent | null = null;
      
      try {
        const result = await this.generateGraph(messages, systemPrompt);
        graph = result.graph;
        lastRawText = result.rawText;
        intent = result.intent; // Capture the intent
        
        console.log('[DEBUG] generated graph:', JSON.stringify(graph, null, 2));
        
        // Handle conversational responses
        if (intent.conversational) {
          return {
            graph: null as any,
            result: {
              graphId: 'conversational',
              success: true,
              nodeResults: new Map(),
              finalOutput: intent.conversationalResponse 
                           ?? 'How can I help you?',
              totalExecutionTime: 0
            },
            generationMs: Date.now() - startTime,
            executionMs: 0,
            prompt: request.prompt,
            storedGraphId: '',
            status: 'success'
          };
        }
      } catch (error) {
        if (error instanceof IntentParseError) {
          const correctionResult = await this.correctGraph(messages, error, systemPrompt, schemaMetadata, error.rawText ?? '');
          graph = correctionResult.graph;
          correctionAttempts = correctionResult.attempts;
          // Note: In correction path, we don't have access to the final intent, but we can reconstruct it from the graph
        } else {
          throw error;
        }
      }

      const generationMs = Date.now() - startTime;

      // Generate readable summary (cheap Haiku call ~100ms)
      if (intent) {
        const summary = await this.generateSummary(intent);
        graph.intentSummary = { 
          action: '', subject: '',  // keep structure for compatibility
          plainText: summary         // add this field
        };
      }

      // Conversational responses never need preview confirmation
      const isConversational = graph.nodes[0]?.id === 'conversational';
      
      if (isConversational) {
        // Execute immediately regardless of preview flag
        const runtime = new GraphRuntime();
        const result = await runtime.execute(graph, {
          maxParallelNodes: request.options?.allowParallel ? 5 : 1,
          dryRun: false
        });
        return {
          graph,
          result,
          generationMs,
          executionMs: 0,
          prompt: request.prompt,
          storedGraphId: '',
          status: 'success'   // not 'preview'
        };
      }

      // Preview mode — save graph and return summary without executing
      if (request.options?.preview) {
        // Save the graph for potential execution
        const stored = await graphRepository.save({
          prompt: request.prompt,
          graph,
          intent,          // ADD — the QueryIntent object
          generationMs,
          executionMs: 0,
          success: true
        });

        // Create a pending turn with expiry for preview
        const pendingTurn: TurnRecord = {
          turnId: crypto.randomUUID(),
          timestamp: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes from now
          rawQuery: request.prompt,
          intentSummary: graph.intentSummary!,
          intent: {
            tables: graph.nodes[0]?.plan?.entity ? [graph.nodes[0].plan.entity] : [],
            filters: graph.nodes[0]?.plan?.where || [],
            aggregate: graph.nodes[0]?.plan?.aggregate ? 
              (Array.isArray(graph.nodes[0].plan.aggregate) ? graph.nodes[0].plan.aggregate : [graph.nodes[0].plan.aggregate]) : undefined,
            groupBy: graph.nodes[0]?.plan?.groupBy,
            having: graph.nodes[0]?.plan?.having,
            orderBy: graph.nodes[0]?.plan?.orderBy ? 
              (Array.isArray(graph.nodes[0].plan.orderBy) ? graph.nodes[0].plan.orderBy : [graph.nodes[0].plan.orderBy]) : undefined,
            distinct: graph.nodes[0]?.plan?.distinct,
            limit: graph.nodes[0]?.plan?.limit
          },
          resultShape: {
            rowCount: 0,
            columns: [],
            primaryTable: graph.nodes[0]?.plan?.entity || 'unknown',
            primaryKeyValues: [],
            sampleRows: []
          }
        };

        // Record pending turn if sessionId provided
        if (request.sessionId && this.sessionStore) {
          await this.sessionStore.appendTurn(request.sessionId, pendingTurn);
        }

        return {
          graph,
          result: {
            graphId: graph.id,
            success: true,
            nodeResults: new Map(),
            finalOutput: null,
            totalExecutionTime: 0
          },
          status: 'preview',
          intentSummary: graph.intentSummary,
          formattedSummary: formatSummary(graph.intentSummary!),
          generationMs,
          executionMs: 0,
          prompt: request.prompt,
          storedGraphId: stored.id
        };
      }

      // Step 2: Validate graph constraints
      this.validateGraphConstraints(graph, request.options);

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
          intent,          // ADD — the QueryIntent object
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
        intent,          // ADD — the QueryIntent object
        generationMs,
        executionMs,
        success: result.success,
        errorMessage: result.success ? undefined : 
          (result.failedNode 
            ? `Failed at node: ${result.failedNode}` 
            : 'Unknown error')
      });

      // Note: We do NOT auto-index here. Indexing happens when an API is approved,
      // not when a graph is generated.

      // Record turn in session after successful execution
      if (request.sessionId && this.sessionStore && result.success) {
        const rows = extractRows(result.finalOutput);
        const queryPlan = graph.nodes[0]?.plan;
        const turn = {
          turnId: crypto.randomUUID(),
          timestamp: Date.now(),
          rawQuery: request.prompt,
          intentSummary: graph.intentSummary!,
          intent: {
            tables: queryPlan?.entity ? [queryPlan.entity] : [],
            filters: queryPlan?.where ? [queryPlan.where] : [],
            aggregate: queryPlan?.aggregate ? (Array.isArray(queryPlan.aggregate) ? queryPlan.aggregate : [queryPlan.aggregate]) : undefined,
            groupBy: queryPlan?.groupBy,
            having: queryPlan?.having,
            orderBy: queryPlan?.orderBy ? (Array.isArray(queryPlan.orderBy) ? queryPlan.orderBy : [queryPlan.orderBy]) : undefined,
            distinct: queryPlan?.distinct,
            limit: queryPlan?.limit
          },
          resultShape: {
            rowCount: rows.length,
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            primaryTable: queryPlan?.entity || '',
            primaryKeyValues: rows.length > 100 
  ? [`${rows.length} rows returned, too many to list individually — use filters to narrow down first`]
  : rows
      .map((r: any) => r['id'] || r[`${queryPlan?.entity || ''}_id`])
      .filter(Boolean)
      .slice(0, 100),
            sampleRows: rows.slice(0, 3)
          }
        };
        await this.sessionStore.appendTurn(request.sessionId, turn);
      }

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

  // Generate human-readable summary using Haiku
  private async generateSummary(
    intent: QueryIntent
  ): Promise<string> {
    // Don't summarise conversational intents
    if (intent.conversational) return '';
    
    const config = getConfig();
    const response = await this.anthropic.messages.create({
      model: config.llm.summaryModel,
      max_tokens: 150,
      system: `You explain database queries in plain English for 
non-technical users. Be concise, friendly, and specific.
2-4 lines maximum. No SQL, no jargon.`,
      messages: [{
        role: 'user',
        content: `Explain what this database query does:\n${JSON.stringify(intent, null, 2)}` 
      }]
    });
    return (response.content[0] as any).text.trim();
  }

  private validateGraphConstraints(
    graph: ExecutionGraph,
    options?: IntentRequest['options']
  ): void {
    const maxNodes = options?.maxNodes ?? 10  // default 10

    if (graph.nodes.length > maxNodes) {
      throw new IntentParseError(
        `Generated graph has ${graph.nodes.length} nodes which exceeds ` +
        `the maximum of ${maxNodes}`,
        {
          nodeCount: graph.nodes.length,
          maxNodes,
          nodeIds: graph.nodes.map(n => n.id)
        }
      );
    }
  }

  private async generateGraph(messages: MessageParam[], systemPrompt: string): Promise<{ graph: ExecutionGraph, rawText: string, intent: QueryIntent }> {
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

    // Extract JSON from markdown fences if present
    let jsonText = rawText;
    
    // Try fenced blocks first — take the last one (model self-corrects)
    const fencedMatches = [
      ...rawText.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)
    ];
    if (fencedMatches.length > 0) {
      jsonText = fencedMatches[fencedMatches.length - 1][1].trim();
    } else {
      // No fences — extract outermost { } block
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = rawText.slice(firstBrace, lastBrace + 1);
      }
    }
  
  // Strip any trailing content after valid JSON
  // Find the end of the first complete JSON object
  let depth = 0;
  let jsonEnd = -1;
  for (let i = 0; i < jsonText.length; i++) {
    if (jsonText[i] === '{') depth++;
    else if (jsonText[i] === '}') {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }
  if (jsonEnd !== -1 && jsonEnd < jsonText.length - 1) {
    jsonText = jsonText.slice(0, jsonEnd + 1);
  }

    // Parse response text as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate and parse as QueryIntent
    const intent = parsed as QueryIntent;
    
    // Basic validation for QueryIntent
    if (!intent.conversational && (!intent.tables || intent.tables.length === 0)) {
      throw new IntentParseError('QueryIntent must specify tables or be conversational', { intent }, rawText);
    }

    // Compile QueryIntent to ExecutionGraph
    const schema = getSchemaMetadata();
    const graph = compileIntent(intent, schema);
    
    return { graph, rawText, intent };
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
      
      // Add the assistant's previous bad response to provide context
      if (currentRawText) {
        correctedMessages.push({
          role: 'assistant',
          content: currentRawText
        });
      }
      
      // Create correction message for QueryIntent
      const correctionMessage = `The previous QueryIntent had validation errors. Please correct it and return ONLY the corrected QueryIntent JSON.

Error: ${currentError.message}

Return ONLY the corrected QueryIntent JSON with no explanations or markdown fences.`;

      correctedMessages.push({
        role: 'user',
        content: correctionMessage
      });

      try {
        const result = await this.generateGraph(correctedMessages, systemPrompt);
        return { graph: result.graph, attempts }; // Success - no parsing errors
      } catch (parseError) {
        if (parseError instanceof IntentParseError) {
          currentError = parseError;
          currentRawText = parseError.rawText ?? '';
          continue; // Try again
        } else {
          throw parseError; // Different error, re-throw
        }
      }
    }

    // All attempts failed
    throw new IntentParseError(`Failed to generate valid QueryIntent after ${MAX_CORRECTION_ATTEMPTS} correction attempts`, { attempts: MAX_CORRECTION_ATTEMPTS, lastError: currentError });
  }
}

function extractRows(output: any): Record<string, unknown>[] {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (output.rows && Array.isArray(output.rows)) return output.rows;
  return [];
}
