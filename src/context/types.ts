// ------------------------------------------------------------------
// API Layer Types - Stage 2
// ------------------------------------------------------------------

export interface APIDefinition {
  id: string;
  route: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  planId: string;
  status: APIStatus;
  label: string;
  dataLabel?: DataAccessLabel;
  auth?: AuthConfig;
  params?: ParameterDefinition[];
  description?: string;
  examples?: RequestExample[];
  createdAt: Date;
  updatedAt: Date;
}

export type APIStatus = 'GENERATED' | 'DRAFT' | 'REVIEW' | 'ACTIVE' | 'DEPRECATED';

export interface AuthConfig {
  type: 'none' | 'api_key' | 'oauth' | 'jwt';
  required: boolean;
  roles?: string[];
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  source: 'query' | 'path' | 'body' | 'header';
  description?: string;
  validation?: ValidationRule[];
  default?: any;
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'required';
  value: any;
  message?: string;
}

export interface RequestExample {
  description: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  expectedResponse?: any;
}

// ------------------------------------------------------------------
// Runtime Context Types
// ------------------------------------------------------------------

export interface RequestContext {
  api: APIDefinition;
  incomingParams: Record<string, any>;
  user?: UserContext;
  timestamp: Date;
  requestId: string;
}

export interface UserContext {
  id: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface ExecutionContext extends RequestContext {
  hydratedPlan: any; // Will be QueryPlan after hydration
  validationResult?: any; // Will be ValidationResult
}

// ------------------------------------------------------------------
// Generation Types
// ------------------------------------------------------------------

export interface GenerationRequest {
  intent: string;
  examples?: string[];
  constraints?: GenerationConstraints;
}

export interface GenerationConstraints {
  maxParams?: number;
  allowedMethods?: string[];
  authRequired?: boolean;
  responseFormat?: 'json' | 'text';
}

export interface GenerationResult {
  api: APIDefinition;
  plan: any; // QueryPlan
  confidence: number;
  alternatives?: APIDefinition[];
}

// ------------------------------------------------------------------
// Hydration Types
// ------------------------------------------------------------------

export interface HydrationContext {
  plan: any; // QueryPlan
  params: Record<string, any>;
  api: APIDefinition;
}

export interface HydrationResult {
  hydratedPlan: any; // QueryPlan with params injected
  validationResult: any; // ValidationResult
  warnings?: string[];
}

// ------------------------------------------------------------------
// Error Types
// ------------------------------------------------------------------

export class APIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class SanitisationError extends Error {
  constructor(field: string, message: string) {
    super(`Sanitisation failed for ${field}: ${message}`)
    this.name = 'SanitisationError'
  }
}

export type DataAccessLabel = 'public' | 'internal' | 'sensitive' | 'restricted'

// ------------------------------------------------------------------
// TODO: Types to Refactor After Stage 3
// ------------------------------------------------------------------
// The following types should be moved to their respective modules after Stage 3:
//
// HandlerRequest, HandlerResponse -> api/types.ts
// RegistryQuery, RegistryResult -> api/types.ts  
// StoreQuery, StoreResult -> plans/types.ts
//
// Deferred to avoid mid-build refactoring during Stage 2/3 development.
// These are temporarily acceptable in context/types.ts as they're 
// shared across multiple modules and the architecture is still evolving.
//
// Current mixed types in context/types.ts are ACCEPTABLE for now.

// ------------------------------------------------------------------
// Temporary Shared Types (to be moved after Stage 3)
// ------------------------------------------------------------------

export interface HandlerRequest {
  apiId: string;
  params: Record<string, any>;
  headers: Record<string, string>;
  user?: UserContext;
}

export interface HandlerResponse {
  success: boolean;
  data?: any;
  error?: HandlerError;
  metadata?: ResponseMetadata;
}

export interface HandlerError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface ResponseMetadata {
  requestId: string;
  apiId: string;
  executionTime: number;
  planId: string;
  params: Record<string, any>;
}

export interface APIRegistry {
  apis: Map<string, APIDefinition>;
  indexByRoute: Map<string, string>; // route -> apiId
  indexByStatus: Map<APIStatus, Set<string>>; // status -> apiId set
}

export interface RegistryQuery {
  status?: APIStatus;
  route?: string;
  method?: string;
  label?: string;
  limit?: number;
  offset?: number;
}

export interface RegistryResult {
  apis: APIDefinition[];
  total: number;
  hasMore: boolean;
}

export interface StoreQuery {
  id?: string;
  status?: APIStatus;
  limit?: number;
  offset?: number;
}

export interface StoreResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}
