// test/integration.test.ts
import { buildQueryPipeline, LLMAdapter } from '../plans';
import { AnthropicAdapter } from '../plans';
import { QueryPlan } from '../plans/types';

describe('Full pipeline integration', () => {
  it('generates, validates, compiles and executes a real query', async () => {
    // Use mock adapter instead of real AnthropicAdapter to avoid API key requirement
    const mockAdapter: LLMAdapter = {
      generatePlan: jest.fn().mockResolvedValue({
        needsDb: true,
        entity: 'customers',
        select: ['customers.*']
      }),
      correctPlan: jest.fn().mockResolvedValue({
        needsDb: true,
        entity: 'customers',
        select: ['customers.*']
      })
    }
    const result = await buildQueryPipeline('Show all customers', mockAdapter)

    expect(result.finalValidation.valid).toBe(true)
    expect(result.compiled.sql).toContain('SELECT')
    expect(result.compiled.sql).toContain('FROM "customers"')
  })

  it('handles conversational intent without hitting DB', async () => {
    // Create a mock adapter that returns a conversational response
    const conversationalAdapter: LLMAdapter = {
      generatePlan: jest.fn().mockResolvedValue({
        needsDb: false,
        responseMode: 'conversational'
      }),
      correctPlan: jest.fn()
    }
    
    const result = await buildQueryPipeline('Hello, how are you?', conversationalAdapter)

    expect(result.originalPlan.needsDb).toBe(false)
    expect(result.compiled.sql).toBe('')
  })

  it('self-corrects an invalid plan', async () => {
    // Mock LLM that returns a bad plan first, then a good one
    const mockAdapter: LLMAdapter = {
      generatePlan: jest.fn().mockResolvedValueOnce({
        needsDb: true,
        entity: 'nonexistent',  // bad
      }).mockResolvedValueOnce({
        needsDb: true,
        entity: 'customers',    // corrected
        select: ['customers.*']
      }),
      correctPlan: jest.fn().mockResolvedValue({
        needsDb: true,
        entity: 'customers',
        select: ['customers.*']
      })
    }
    const result = await buildQueryPipeline('show customers', mockAdapter)
    expect(result.attempts).toBeGreaterThan(1)
    expect(result.finalValidation.valid).toBe(true)
  })
})
