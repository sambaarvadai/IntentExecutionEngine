// ------------------------------------------------------------------
// Execution Module Public Interface
// ------------------------------------------------------------------

// Compile functionality
export {
  compileQuery,
  CompiledQuery,
} from './compile';

// Execute functionality
export {
  executeCompiledQuery,
} from './executeCompiled';

// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
