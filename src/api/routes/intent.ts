import { IntentEngine } from '../../intent';
import { getDatabase } from '../../db/sqlite';
import { SessionStore } from '../../session/store';
import { createRouter } from './graphs';
import { GraphRuntime } from '../../graph/runtime';
import { ExecutionGraph } from '../../graph/types';
import { graphRepository } from '../../graph/store';
import { formatSummary } from '../../intent/intentCompiler';
import { TurnRecord } from '../../session/types';

export function createIntentRouter(engine: IntentEngine, sessionStore: SessionStore) {
  const router = createRouter();

  // Helper function to parse JSON body
  function parseJsonBody(req: any): any {
    if (req.body && typeof req.body === 'object') {
      return req.body;
    }
    
    // Try to parse raw body if available
    if (req.body === undefined && req.readable) {
      let data = '';
      req.on('data', (chunk: any) => {
        data += chunk;
      });
      
      return new Promise((resolve) => {
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      });
    }
    
    return null;
  }

  // POST /api/intent - Execute intent with session support
  router.post('/intent', async (req: any, res: any) => {
    try {
      // Parse JSON body manually if needed
      let body = req.body;
      if (!body) {
        try {
          body = JSON.parse(req.data || '');
        } catch {
          return res.status(400).json({
            error: 'Request body is required and must be valid JSON',
            status: 'error'
          });
        }
      }

      // Validate request body
      if (!body || typeof body !== 'object') {
        return res.status(400).json({
          error: 'Request body is required and must be valid JSON',
          status: 'error'
        });
      }

      if (!body.prompt) {
        return res.status(400).json({
          error: 'prompt is required in request body',
          status: 'error'
        });
      }

      const sessionId = req.headers['x-session-id'] as string 
                        ?? body.sessionId 
                        ?? crypto.randomUUID();
      
      const result = await engine.execute({
        prompt: body.prompt,
        sessionId,
        options: { 
          preview: body.preview ?? false,
          dryRun: body.dryRun ?? false,
          allowParallel: body.allowParallel ?? true
        }
      });

      // Return sessionId so client can track it
      res.setHeader('x-session-id', sessionId);
      res.json(result);
    } catch (error) {
      console.error('Intent execution error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });
    }
  });

  // POST /api/intent/execute - Execute stored graph
  router.post('/intent/execute', async (req: any, res: any) => {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Request body is required and must be valid JSON',
        status: 'error'
      });
    }

    const { graphId } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    if (!graphId) {
      return res.status(400).json({ 
        error: 'graphId is required' 
      });
    }

    try {
      // Load the stored graph
      const stored = await graphRepository.findById(graphId);
      if (!stored) {
        return res.status(404).json({ 
          error: `Graph ${graphId} not found` 
        });
      }

      const graph = JSON.parse(stored.graphJson) as ExecutionGraph;

      // Execute it
      const runtime = new GraphRuntime();
      const startTime = Date.now();
      const result = await runtime.execute(graph, {
        maxParallelNodes: 1,
        dryRun: false
      });
      const executionMs = Date.now() - startTime;

      // Record turn in session if sessionId provided
      if (sessionId && result.success) {
        const rows = extractRows(result.finalOutput);
        const intent = stored.intentJson 
          ? JSON.parse(stored.intentJson) 
          : null;
        
        // Record turn regardless — intent fields are best-effort
        const turn: TurnRecord = {
          turnId: crypto.randomUUID(),
          timestamp: Date.now(),
          rawQuery: stored.prompt,
          intentSummary: graph.intentSummary ?? {
            action: 'Query',
            subject: 'results'
          },
          intent: intent ? {
            tables: intent.tables ?? [],
            filters: intent.filters ?? [],
            aggregate: intent.aggregate,
            groupBy: intent.groupBy,
            having: intent.having,
            orderBy: Array.isArray(intent.orderBy)
              ? intent.orderBy
              : intent.orderBy ? [intent.orderBy] : undefined,
            distinct: intent.distinct,
            limit: intent.limit
          } : {
            tables: [],
            filters: []
          },
          resultShape: {
            rowCount: rows.length,
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            primaryTable: graph.nodes[0]?.plan?.entity ?? 'unknown',
            primaryKeyValues: rows
              .map((r: any) => r['id'])
              .filter(Boolean)
              .slice(0, 100),
            sampleRows: rows.slice(0, 3)
          }
        };
        await sessionStore.appendTurn(sessionId, turn);
      }

      res.setHeader('x-session-id', sessionId ?? '');
      return res.json({
        status: 'success',
        result,
        executionMs,
        graphId,
        intentSummary: graph.intentSummary,
        formattedSummary: formatSummary(graph.intentSummary!)
      });

    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}

function extractRows(output: any): Record<string, unknown>[] {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (output?.rows && Array.isArray(output.rows)) return output.rows;
  return [];
}
