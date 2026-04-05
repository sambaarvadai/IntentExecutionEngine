// test/hydrator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
import { planHydrator } from '../api';
import { QueryPlan } from '../plans/types';
import { APIDefinition, ParameterDefinition } from '../context/types';

// Mock the database module
jest.mock('../db/sqlite', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock the schema configuration
jest.mock('../config', () => ({
  getConfig: () => ({
    database: {
      path: ':memory:',
      filename: 'test.db'
    },
    llm: {
      model: 'claude-3-haiku-20240307',
      maxTokens: 1000
    }
  }),
  getSchemaConfig: () => ({
    tables: {
      accounts: {
        description: "Companies or organisations tracked in the CRM",
        primaryKey: "id",
        fields: {
          id: { type: "integer", filterable: true, selectable: true, sortable: true },
          name: { type: "text", filterable: true, selectable: true, sortable: true },
          city: { type: "text", filterable: true, selectable: true, sortable: true },
          status: { type: "text", filterable: true, selectable: true, sortable: true }
        }
      }
    }
  })
}));

describe('hydratePlan', () => {
  it('injects :param references into WHERE conditions', async () => {
    const plan: QueryPlan = {
      needsDb: true,
      entity: 'accounts',
      where: [{ field: 'accounts.city', op: '=', value: ':city' }]
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
      entity: 'accounts',
      where: [{ field: 'accounts.city', op: '=', value: ':city' }]
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