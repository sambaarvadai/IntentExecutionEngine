// ------------------------------------------------------------------
// Plans Module Public Interface
// ------------------------------------------------------------------

// Types — shared contract, full export is fine
export type {
  QueryPlan,
  AnyPlan,
  WhereCondition,
  JoinDef,
  AggregateDef,
  OrderByDef,
  QueryResult,
  ExecutionResult,
} from './types';

// Plan store — only the public operations
export {
  PlanStore,
  planStore,
} from './store';

// Validation — only the public function
export {
  validatePlan,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './validator';

// Pipeline — only what other modules need to call
export {
  buildQueryPipeline,
  PipelineResult,
  QueryPipelineError,
  LLMAdapter,
} from './queryPlan';

// LLM Implementation — Anthropic adapter
export {
  AnthropicAdapter,
} from './anthropicAdapter';

// Note: Internal helpers in these files stay private
// Nothing else is visible outside this module
