// test/hydrator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
import { planHydrator } from '../api';
import { QueryPlan } from '../plans/types';
import { APIDefinition, ParameterDefinition } from '../context/types';

describe('hydratePlan', () => {
  it('injects :param references into WHERE conditions', async () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      where: [{ field: 'customers.city', op: '=', value: ':city' }]
    }
    const api: APIDefinition = { 
      id: 'test',
      route: '/test',
      method: 'GET',
      planId: 'test-plan',
      status: 'ACTIVE',
      label: 'Test API',
      params: [{ name: 'city', type: 'string', required: true, source: 'query' as const }],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const result = await planHydrator.hydrate({ plan, params: { city: 'Chennai' }, api })
    expect(result.hydratedPlan.where[0].value).toBe('Chennai')
  })

  it('throws on missing required param', async () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'customers',
      where: [{ field: 'customers.city', op: '=', value: ':city' }]
    }
    const api: APIDefinition = {
      id: 'test',
      route: '/test',
      method: 'GET',
      planId: 'test-plan',
      status: 'ACTIVE',
      label: 'Test API',
      params: [{ name: 'city', type: 'string', required: true, source: 'query' as const }],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    await expect(planHydrator.hydrate({ plan, params: {}, api }))
      .rejects.toThrow('Required parameter')
  })
})