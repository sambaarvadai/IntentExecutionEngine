// ------------------------------------------------------------------
// Graph API Routes
// ------------------------------------------------------------------

import { graphRepository } from '../../graph/store';
import { GraphStatus, StoredGraph } from '../../graph/store/types';
import { GraphRuntime } from '../../graph/runtime';
import { ExecutionGraph } from '../../graph/types';
import { IntentEngine } from '../../intent';
import { IntentParseError } from '../../intent';
import Anthropic from '@anthropic-ai/sdk';

// ------------------------------------------------------------------
// Route Handler Types (simple Express-like interface)
// ------------------------------------------------------------------

export interface RouteHandler {
  (req: any, res: any): Promise<void>;
}

export interface Router {
  get(path: string, handler: RouteHandler): void;
  patch(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  routes: Map<string, { method: string; handler: RouteHandler }>;
}

// ------------------------------------------------------------------
// Simple Router Implementation
// ------------------------------------------------------------------

export function createRouter(): Router {
  const routes = new Map<string, { method: string; handler: RouteHandler }>();
  
  return {
    get(path: string, handler: RouteHandler) {
      routes.set(`GET:${path}`, { method: 'GET', handler });
    },
    
    patch(path: string, handler: RouteHandler) {
      routes.set(`PATCH:${path}`, { method: 'PATCH', handler });
    },
    
    post(path: string, handler: RouteHandler) {
      routes.set(`POST:${path}`, { method: 'POST', handler });
    },
    
    routes
  };
}

// ------------------------------------------------------------------
// Graph Router
// ------------------------------------------------------------------

export const graphRouter = createRouter();

// GET /graphs
graphRouter.get('/graphs', async (req: any, res: any) => {
  try {
    const { status, limit, offset, q } = req.query || {};
    
    const graphs = await graphRepository.query({
      status: status as GraphStatus,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      promptContains: q
    });
    
    // Get total count (query without limit/offset)
    const totalGraphs = await graphRepository.query({
      status: status as GraphStatus,
      promptContains: q
    });
    
    res.json({ graphs, total: totalGraphs.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /graphs/stats
graphRouter.get('/graphs/stats', async (req: any, res: any) => {
  try {
    const stats = await graphRepository.stats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /graphs/:id
graphRouter.get('/graphs/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const graph = await graphRepository.findById(id);
    
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PATCH /graphs/:id/status
graphRouter.patch('/graphs/:id/status', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, approvalNote } = req.body;
    
    // Validate status
    const validStatuses: GraphStatus[] = ['draft', 'approved', 'rejected', 'deprecated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: draft, approved, rejected, deprecated' 
      });
    }
    
    const updatedGraph = await graphRepository.updateStatus({
      id,
      status,
      approvedBy,
      approvalNote
    });
    
    res.json(updatedGraph);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /graphs/:id/execute
graphRouter.post('/graphs/:id/execute', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    // Fetch stored graph by id
    const storedGraph = await graphRepository.findById(id);
    if (!storedGraph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    // Check if graph is approved
    if (storedGraph.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Graph must be approved before execution' 
      });
    }
    
    // Deserialize graphJson to ExecutionGraph
    const graph: ExecutionGraph = JSON.parse(storedGraph.graphJson);
    
    // Execute graph using GraphRuntime
    const runtime = new GraphRuntime();
    const result = await runtime.execute(graph, req.body.options);
    
    // Increment usage count
    await graphRepository.incrementUsage(id);
    
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /graphs/validate
graphRouter.post('/graphs/validate', async (req: any, res: any) => {
  try {
    const { prompt, context } = req.body;
    
    // Validate request body
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Prompt is required and must be a string' 
      });
    }
    
    // Construct IntentRequest with dryRun: true
    const intentRequest = {
      prompt,
      context,
      options: { dryRun: true }
    };
    
    // Execute using IntentEngine
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    const engine = new IntentEngine(anthropic);
    const result = await engine.execute(intentRequest);
    
    // Return validation response
    res.json({
      graphId: result.storedGraphId,
      graph: result.graph,
      generationMs: result.generationMs,
      valid: true,
      nodeCount: result.graph.nodes.length
    });
  } catch (error) {
    if (error instanceof IntentParseError) {
      // Return 422 for IntentParseError
      return res.status(422).json({
        valid: false,
        error: error.message,
        details: error.details
      });
    }
    
    // Return 500 for any other error
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Export the router for registration
export default graphRouter;
