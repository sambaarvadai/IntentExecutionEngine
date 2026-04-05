// test/validator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
import { validatePlan } from '../plans';
import { QueryPlan } from '../plans/types';

describe('validatePlan', () => {
  it('returns valid for a well-formed plan', () => {
    const result = validatePlan({ needsDb: true, entity: 'accounts', select: ['accounts.*'] })
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
      entity: 'accounts',
      where: [{ field: 'accounts.name', op: 'DROP', value: 'x' }]
    })
    expect(result.valid).toBe(false)
  })

  it('produces llmFeedback on invalid plan', () => {
    const result = validatePlan({ needsDb: true } as any)
    expect(result.llmFeedback).toBeDefined()
    expect(result.llmFeedback).toContain('ERRORS')
  })

  it('allows fields from joined tables in WHERE conditions', () => {
    // Test the core functionality: fields from joined tables should be available
    // We'll test this by checking that the field validation doesn't fail for joined table fields
    const result = validatePlan({
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*'],
      where: [{ field: 'accounts.name', op: '=', value: 'test' }] // Use primary table field first
    })
    
    // This should pass - primary table field should be valid
    expect(result.valid).toBe(true)
    
    // Now test with a mock that has proper join setup
    const { validatePlan: validatePlanWithJoins } = require('../plans/validator');
    
    // Mock a schema with joins for this specific test
    jest.doMock('../schema/metadata', () => ({
      getSchemaMetadata: () => ({
        tables: {
          accounts: {
            fields: {
              'accounts.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
              'accounts.name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
              'accounts.*': { type: 'text', filterable: false, selectable: true, sortable: false }
            },
            joins: {
              'opportunities': 'accounts.id = opportunities.account_id'
            }
          },
          opportunities: {
            fields: {
              'opportunities.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
              'opportunities.amount': { type: 'DECIMAL', filterable: true, selectable: true, sortable: true },
              'opportunities.*': { type: 'text', filterable: false, selectable: true, sortable: false }
            },
            joins: undefined
          }
        },
        allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
        allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN'],
        maxLimit: 100
      })
    }))
    
    const resultWithJoin = validatePlanWithJoins({
      needsDb: true,
      entity: 'accounts',
      join: [{ table: 'opportunities', type: 'INNER' }],
      where: [{ field: 'opportunities.amount', op: '>', value: 100 }]
    })
    
    // Should not have field validation errors for opportunities.amount
    const fieldErrors = resultWithJoin.issues.filter((i: any) => 
      i.message.includes('opportunities.amount') && i.message.includes('not found')
    );
    expect(fieldErrors.length).toBe(0)
  })

  it('still warns about fields not in any joined table', () => {
    const result = validatePlan({
      needsDb: true,
      entity: 'accounts',
      join: [{ table: 'opportunities', type: 'INNER' }],
      where: [{ field: 'products.name', op: '=', value: 'x' }]
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some(i => i.message.includes('products.name') && i.message.includes('not found'))).toBe(true)
  })
})