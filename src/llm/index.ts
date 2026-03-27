// ------------------------------------------------------------------
// LLM Module Public Interface
// ------------------------------------------------------------------

// Export LLM interpretation functionality
export { interpretUserRequest } from './interpret';

// Export prompt building functionality
export { buildSystemPrompt, generateSchemaInfo, getFullSystemPrompt } from './prompts';

// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
