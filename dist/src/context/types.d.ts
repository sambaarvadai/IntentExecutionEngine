import { ExecutionGraph } from '../graph/types';
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
    executionGraph?: ExecutionGraph;
    generatingPrompts?: string[];
    createdFrom?: 'manual' | 'intent';
    storedGraphId?: string;
    nodeCount?: number;
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
    hydratedPlan: any;
    validationResult?: any;
}
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
    graph: ExecutionGraph;
    storedGraphId?: string;
    confidence: number;
    alternatives?: APIDefinition[];
}
export interface HydrationContext {
    plan: any;
    params: Record<string, any>;
    api: APIDefinition;
}
export interface HydrationResult {
    hydratedPlan: any;
    validationResult: any;
    warnings?: string[];
}
export declare class APIError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: any | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: any | undefined);
}
export declare class ValidationError extends APIError {
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends APIError {
    constructor(message?: string);
}
export declare class UnauthorizedError extends APIError {
    constructor(message?: string);
}
export declare class SanitisationError extends Error {
    constructor(field: string, message: string);
}
export type DataAccessLabel = 'public' | 'internal' | 'sensitive' | 'restricted';
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
    indexByRoute: Map<string, string>;
    indexByStatus: Map<APIStatus, Set<string>>;
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
//# sourceMappingURL=types.d.ts.map