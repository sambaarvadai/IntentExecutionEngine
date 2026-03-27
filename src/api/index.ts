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

// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
