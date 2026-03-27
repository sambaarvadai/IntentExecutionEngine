// test/compiler.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
import { compileQuery } from '../execution';
import { QueryPlan } from '../plans/types';

describe('compileQuery', () => {
  it('compiles a simple SELECT', () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      select: ['customers.name', 'customers.city'],
    }
    const result = compileQuery(plan)
    expect(result.sql).toBe('SELECT customers.name, customers.city FROM customers')
    expect(result.params).toEqual([])
  })

  it('blocks SQL injection in entity name', () => {
    const plan = { needsDb: true, entity: 'customers; DROP TABLE customers;' } as any
    expect(() => compileQuery(plan)).toThrow('Invalid identifier')
  })

  it('handles IN operator correctly', () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      select: ['customers.*'],
      where: [{ field: 'customers.city', op: 'IN', value: ['Chennai', 'Mumbai'] }]
    }
    const result = compileQuery(plan)
    expect(result.sql).toContain('IN (?, ?)')
    expect(result.params).toEqual(['Chennai', 'Mumbai'])
  })

  it('handles IS NULL without pushing a param', () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      select: ['customers.*'],
      where: [{ field: 'customers.email', op: 'IS NULL', value: undefined }]
    }
    const result = compileQuery(plan)
    expect(result.sql).toContain('IS NULL')
    expect(result.params).toHaveLength(0)
  })

  it('handles BETWEEN with two params', () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'orders',
      select: ['orders.*'],
      where: [{ field: 'orders.amount', op: 'BETWEEN', value: [100, 500] }]
    }
    const result = compileQuery(plan)
    expect(result.sql).toContain('BETWEEN ? AND ?')
    expect(result.params).toEqual([100, 500])
  })

  it('handles OR conditions', () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      select: ['customers.*'],
      where: [
        { field: 'customers.city', op: '=', value: 'Chennai' },
        { field: 'customers.city', op: '=', value: 'Mumbai', logic: 'OR' }
      ]
    }
    const result = compileQuery(plan)
    expect(result.sql).toContain('OR')
  })

  it('parameterizes LIMIT, not interpolates', () => {
    const plan: QueryPlan = { needsDb: true, entity: 'customers', limit: 10 }
    const result = compileQuery(plan)
    expect(result.sql).toContain('LIMIT ?')
    expect(result.params).toContain(10)
  })
})