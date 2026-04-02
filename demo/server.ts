#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../src/api';
import { getDatabase } from '../src/db/sqlite';
import { SessionStore } from '../src/session/store';
import Anthropic from '@anthropic-ai/sdk';
import { IntentEngine } from '../src/intent';
import { graphRepository } from '../src/graph/store';
import { ExecutionGraph } from '../src/graph/types';
import { GraphRuntime } from '../src/graph/runtime';
import { TurnRecord } from '../src/session/types';
import { formatSummary } from '../src/intent/intentCompiler';
import { getConfig } from '../src/config';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services and routes
async function initializeServer() {
  // Load configuration
  const config = getConfig();
  
  // Initialize database and services
  const db = await getDatabase();
  const sessionStore = new SessionStore(db);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const intentEngine = new IntentEngine(anthropic, sessionStore);
  
  // Register intent routes
  // Note: We're using direct Express routes below instead of custom router
  // const intentRouter = createIntentRouter(intentEngine, sessionStore);
  
  console.log(`[DEBUG] Using direct Express routes for intent endpoints`);
  
  // Run cleanup on configurable schedule, drop sessions inactive > maxAgeMs
  setInterval(async () => {
    const dropped = await sessionStore.cleanup(config.session.maxAgeMs);
    if (dropped > 0) console.log(`Dropped ${dropped} stale sessions`);
  }, config.session.cleanupIntervalMs);
  
  // Register API routes using custom registration
  registerRoutes(app);
  
  // Health check endpoint
  app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Register intent routes directly with Express for proper middleware support
  app.post('/api/intent', async (req: any, res: any) => {
    console.log(`[DEBUG] Direct Express /api/intent route called`);
    console.log(`[DEBUG] req.body:`, req.body);
    console.log(`[DEBUG] req.headers:`, req.headers);
    
    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          error: 'Request body is required and must be valid JSON',
          status: 'error'
        });
      }

      if (!req.body.prompt) {
        return res.status(400).json({
          error: 'prompt is required in request body',
          status: 'error'
        });
      }

      const sessionId = req.headers['x-session-id'] as string 
                        ?? req.body.sessionId 
                        ?? crypto.randomUUID();
      
      const result = await intentEngine.execute({
        prompt: req.body.prompt,
        sessionId,
        options: { 
          preview: req.body.preview ?? false,
          dryRun: req.body.dryRun ?? false,
          allowParallel: req.body.allowParallel ?? true
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

  app.post('/api/intent/execute', async (req: any, res: any) => {
    try {
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

  // DELETE /api/session/:sessionId - Explicit session deletion
  app.delete('/api/session/:sessionId', async (req: any, res: any) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'sessionId is required'
        });
      }

      await sessionStore.delete(sessionId);
      
      res.json({
        status: 'success',
        message: `Session ${sessionId} deleted`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Intent Execution Engine API Server`);
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Graph stats: http://localhost:${PORT}/api/graphs/stats`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  POST /api/intent - Execute intent with session support');
    console.log('  POST /api/intent/execute - Execute stored graph');
    console.log('  POST /api/graphs/validate - Validate intent');
    console.log('  GET  /api/graphs/:id - Get graph by ID');
    console.log('  PATCH /api/graphs/:id/status - Update graph status');
    console.log('  GET  /api/graphs/stats - Get graph statistics');
    console.log('  GET  /api/apis - List APIs');
    console.log('  GET  /api/apis/:id - Get API by ID');
    console.log('  PATCH /api/apis/:id/status - Update API status');
  });
}

initializeServer().catch(console.error);

function extractRows(output: any): Record<string, unknown>[] {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (output?.rows && Array.isArray(output.rows)) return output.rows;
  return [];
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
