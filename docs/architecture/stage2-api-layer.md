# API Layer Design

## Core types
- APIDefinition: { id, route, method, planId, status, label, auth, params }
- Status flow: GENERATED → DRAFT → REVIEW → ACTIVE → DEPRECATED

## File structure
/api
  registry.ts       — stores and retrieves APIDefinitions
  handler.ts        — generic request handler, resolves route → plan → execute
  generator.ts      — LLM generates route + plan binding from intent
  hydrate.ts        — injects request params into QueryPlan at runtime

/plans
  store.ts          — persists and retrieves QueryPlans by ID

## Key invariants
- handler.ts never imports from compiler directly — goes through plan store
- data access label derived from schema metadata, not assigned by LLM
- draft saving is async via queue, never blocks response
- confirmation payload always generated from structured JSON, not prose

## What exists already
- compiler.ts       — compileQuery(plan) → { sql, params }
- validatePlan.ts   — validatePlan(plan) → ValidationResult with llmFeedback
- queryPipeline.ts  — full pipeline with LLM self-correction loop

## Current Project Context
This is a TypeScript/Node.js NL2DB system with:
- SQLite database with customers/orders schema
- Enhanced query pipeline with LLM self-correction
- Response reframing system for natural language outputs
- Fixed validator with JOIN support
- Configuration-driven feature toggles

## Next Steps
Build API layer to expose NL2DB capabilities via REST endpoints while maintaining all existing CLI functionality.
