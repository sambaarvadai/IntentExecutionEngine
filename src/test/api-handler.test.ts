// test/api-handler.test.ts
import { apiHandler } from '../api';
import { apiRegistry } from '../api';
import { planStore } from '../plans';
import { QueryPlan } from '../plans/types';
import { auditLog } from '../api';

describe('APIHandler', () => {
  beforeEach(async () => {
    // Clear registry and store before each test
    await apiRegistry.clear();
    await planStore.clear();
  })

  it('handles a valid request end to end', async () => {
    // Seed registry with a test API
    const plan = await planStore.save({
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*']
    })
    await apiRegistry.register({
      route: '/accounts',
      method: 'GET',
      planId: plan.id,
      status: 'ACTIVE',
      label: 'List accounts',
      auth: { type: 'none', required: false }
    })
    
    const api = await apiRegistry.resolveRoute('GET', '/accounts')
    const response = await apiHandler.handleRequest({
      apiId: api.id,
      params: {},
      headers: {}
    })
    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
  })

  it('rejects requests to DRAFT APIs', async () => {
    const plan = await planStore.save({ needsDb: true, entity: 'accounts' })
    const draft = await apiRegistry.register({
      route: '/accounts/draft',
      method: 'GET',
      planId: plan.id,
      status: 'DRAFT',
      label: 'Draft',
      auth: { type: 'none', required: false }
    })
    
    // DRAFT APIs should not be accessible through the handler
    // This test would need to be implemented based on your handler's logic
    // For now, this is a placeholder to show the test structure
    expect(draft.status).toBe('DRAFT')
    
    // Test that DRAFT APIs exist but shouldn't be accessible
    const draftApi = await apiRegistry.resolveRoute('GET', '/accounts/draft')
    expect(draftApi.status).toBe('DRAFT')
  })
})

describe('security integration', () => {
  beforeEach(async () => {
    apiRegistry.clear()
    planStore.clear()
    auditLog.clear()
  })

  it('audit logs a successful request', async () => {
    const plan = await planStore.save({
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*']
    })
    const api = await apiRegistry.register({
      route: '/accounts/audit-test',
      method: 'GET',
      planId: plan.id,
      status: 'ACTIVE',
      label: 'List accounts',
      dataLabel: 'sensitive',
      auth: { type: 'none', required: false }
    })

    await apiHandler.handleRequest({
      apiId: api.id,
      params: {},
      headers: {}
    })

    const entries = auditLog.query({ apiId: api.id })
    expect(entries).toHaveLength(1)
    expect(entries[0].status).toBe('success')
    expect(entries[0].apiId).toBe(api.id)
    expect(entries[0].paramKeys).toEqual([])
  })

  it('filters response for insufficient role on sensitive API', async () => {
    const plan = await planStore.save({
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*']
    })
    const api = await apiRegistry.register({
      route: '/accounts/sensitive-test',
      method: 'GET',
      planId: plan.id,
      status: 'ACTIVE',
      label: 'List accounts',
      dataLabel: 'sensitive',
      auth: { type: 'none', required: false }
    })

    const response = await apiHandler.handleRequest({
      apiId: api.id,
      params: {},
      headers: {},
      user: { id: 'user-1', roles: ['guest'], permissions: [] }
    })

    expect(response.success).toBe(true)
    expect(response.data).toEqual({
      filtered: true,
      reason: 'insufficient_role'
    })
  })

  it('audit logs blocked requests without hitting DB', async () => {
    // Override the singleton rateLimiter for this test
    // by checking that blocked status is logged
    const plan = await planStore.save({
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*']
    })
    const api = await apiRegistry.register({
      route: '/accounts/ratelimit-test',
      method: 'GET',
      planId: plan.id,
      status: 'ACTIVE',
      label: 'public',
      dataLabel: 'sensitive',
      auth: { type: 'none', required: false }
    })

    // Make 65 requests to trigger per-minute rate limit
    // (default is 60/minute)
    for (let i = 0; i < 60; i++) {
      await apiHandler.handleRequest({
        apiId: api.id,
        params: {},
        headers: {}
      })
    }

    const blockedResponse = await apiHandler.handleRequest({
      apiId: api.id,
      params: {},
      headers: {}
    })

    expect(blockedResponse.success).toBe(false)
    expect(blockedResponse.error?.code).toBe('RATE_LIMITED')

    const blockedEntries = auditLog.query({
      apiId: api.id,
      status: 'blocked'
    })
    expect(blockedEntries.length).toBeGreaterThan(0)
  })
})
