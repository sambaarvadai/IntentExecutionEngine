// test/validator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
import { validatePlan } from '../plans';
import { QueryPlan } from '../plans/types';

describe('validatePlan', () => {
  it('returns valid for a well-formed plan', () => {
    const result = validatePlan({ needsDb: true, entity: 'customers', select: ['customers.*'] })
    expect(result.valid).toBe(true)
  })

  it('returns error for missing entity', () => {
    const result = validatePlan({ needsDb: true } as any)
    expect(result.valid).toBe(false)
    expect(result.issues.some(i => i.field === 'entity')).toBe(true)
  })

  it('returns error for unknown table', () => {
    const result = validatePlan({ needsDb: true, entity: 'nonexistent_table' } as any)
    expect(result.valid).toBe(false)
  })

  it('returns error for disallowed operator', () => {
    const result = validatePlan({
      needsDb: true,
      entity: 'customers',
      where: [{ field: 'customers.name', op: 'DROP', value: 'x' }]
    })
    expect(result.valid).toBe(false)
  })

  it('produces llmFeedback on invalid plan', () => {
    const result = validatePlan({ needsDb: true } as any)
    expect(result.llmFeedback).toBeDefined()
    expect(result.llmFeedback).toContain('ERRORS')
  })
})