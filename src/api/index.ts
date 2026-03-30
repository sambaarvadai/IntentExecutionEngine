// ------------------------------------------------------------------
// API Module Public Interface
// ------------------------------------------------------------------

// Registry - only public operations
export {
  APIRegistryManager,
  apiRegistry,
  RegistryMetrics,
} from './registry';

// Handler - only public interface
export {
  APIHandler,
  apiHandler,
} from './handler';

// Hydration - only public interface  
export {
  PlanHydrator,
  planHydrator,
} from './hydrate';

// Generator - only public interface
export {
  APIGenerator,
  apiGenerator,
  APIGeneratorConfig,
} from './generator';

// Sanitisation - only public interface
export {
  sanitiseString,
  sanitiseNumber,
  sanitiseBoolean,
  sanitiseArray,
  sanitiseParams,
} from './sanitise';

// Rate Limiting - only public interface
export {
  RateLimiter,
  rateLimiter,
} from './rateLimit';

// Audit - only public interface
export {
  AuditLog,
  auditLog,
} from './audit';

// Response Filtering - only public interface
export {
  filterResponse,
  stripFields,
} from './responseFilter';

// Routes - only public interface
export {
  graphRouter,
  createRouter,
  type Router,
  type RouteHandler,
} from './routes/graphs';

// ------------------------------------------------------------------
// Route Registration
// ------------------------------------------------------------------

import { graphRouter } from './routes/graphs';

// Export all registered routers for easy access
export const routers = {
  graphs: graphRouter,
};

// Export a function to register all routes with a web framework
export function registerRoutes(app: any) {
  // Simple Express-style registration
  if (app.use && typeof app.use === 'function') {
    // Register graph routes under /api prefix
    app.use('/api', (req: any, res: any, next: any) => {
      const path = req.path;
      const method = req.method.toUpperCase();
      
      // Find matching route
      for (const [routeKey, { handler }] of graphRouter.routes) {
        const [routeMethod, routePath] = routeKey.split(':');
        
        if (routeMethod === method && path === routePath) {
          return handler(req, res);
        }
      }
      
      next();
    });
  }
  
  return routers;
}

// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
