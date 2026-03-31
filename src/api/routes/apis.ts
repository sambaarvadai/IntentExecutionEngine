// ------------------------------------------------------------------
// API Management Routes
// ------------------------------------------------------------------

import { apiRegistry } from '../registry';
import { APIDefinition, APIStatus } from '../../context/types';
import { createSearchService } from '../../search';

// Initialize search service
const searchService = createSearchService(
  process.env.VOYAGE_API_KEY || '',
  process.env.CHROMA_URL || 'http://localhost:8000'
);

// Initialize search service
searchService.init().catch(err => {
  console.error('Failed to initialize search service:', err);
});

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
// API Router
// ------------------------------------------------------------------

export const apiRouter = createRouter();

// GET /apis
apiRouter.get('/apis', async (req: any, res: any) => {
  try {
    const { status, limit, offset, route, method, label } = req.query || {};
    
    const result = await apiRegistry.query({
      status: status as APIStatus,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      route,
      method,
      label
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /apis/:id
apiRouter.get('/apis/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const api = await apiRegistry.get(id);
    
    res.json(api);
  } catch (error) {
    res.status(404).json({ error: 'API not found' });
  }
});

// PATCH /apis/:id/status
apiRouter.patch('/apis/:id/status', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses: APIStatus[] = ['GENERATED', 'DRAFT', 'REVIEW', 'ACTIVE', 'DEPRECATED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: GENERATED, DRAFT, REVIEW, ACTIVE, DEPRECATED' 
      });
    }
    
    // Update API status
    const updatedApi = await apiRegistry.updateStatus(id, status);
    
    // Wire search service integration
    if (updatedApi.status === 'ACTIVE' || updatedApi.status === 'REVIEW') {
      // Fire and forget — don't block the response on indexing
      searchService.indexAPI(updatedApi).catch(err => {
        console.error('Failed to index API in ChromaDB:', err);
      });
    }

    if (updatedApi.status === 'DEPRECATED') {
      searchService.removeFromIndex(updatedApi.id).catch(err => {
        console.error('Failed to remove API from ChromaDB:', err);
      });
    }
    
    res.json(updatedApi);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Export router for registration
export default apiRouter;
