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

export {
  apiRouter,
} from './routes/apis';

// ------------------------------------------------------------------
// Route Registration
// ------------------------------------------------------------------

import { graphRouter } from './routes/graphs';
import { apiRouter } from './routes/apis';

// Export all registered routers for easy access
export const routers = {
  graphs: graphRouter,
  apis: apiRouter,
};

// Export a function to register all routes with a web framework
export function registerRoutes(app: any) {
  // Simple Express-style registration
  if (app.use && typeof app.use === 'function') {
    // Register graph routes under /api prefix
    app.use('/api', (req: any, res: any, next: any) => {
      const originalUrl = req.originalUrl || req.url;
      const path = req.path;
      const method = req.method.toUpperCase();
      
      // Check graph routes first
      for (const [routeKey, { handler }] of graphRouter.routes) {
        // Split on the first colon only to handle paths with :params
        const colonIndex = routeKey.indexOf(':');
        const routeMethod = routeKey.substring(0, colonIndex);
        const routePath = routeKey.substring(colonIndex + 1);
        
        if (routeMethod === method) {
          // Handle path parameters by converting route pattern to regex
          if (routePath.includes(':')) {
            const regexPattern = routePath
              .replace(/:[^/]+/g, '([^/]+)')
              .replace(/\//g, '\\/');
            const regex = new RegExp(`^${regexPattern}$`);
            
            if (regex.test(path)) {
              // Extract params
              const paramNames = (routePath.match(/:[^/]+/g) || []).map(name => name.substring(1));
              const paramValues = path.match(regex)?.slice(1) || [];
              const params: Record<string, string> = {};
              
              paramNames.forEach((name, index) => {
                params[name] = paramValues[index];
              });
              
              req.params = params;
              return handler(req, res);
            }
          } else if (path === routePath) {
            return handler(req, res);
          }
        }
      }
      
      // Check API routes next
      for (const [routeKey, { handler }] of apiRouter.routes) {
        // Split on the first colon only to handle paths with :params
        const colonIndex = routeKey.indexOf(':');
        const routeMethod = routeKey.substring(0, colonIndex);
        const routePath = routeKey.substring(colonIndex + 1);
        
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
