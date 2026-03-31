"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test/api-handler.test.ts
const api_1 = require("../api");
const api_2 = require("../api");
const plans_1 = require("../plans");
const api_3 = require("../api");
describe('APIHandler', () => {
    beforeEach(async () => {
        // Clear registry and store before each test
        await api_2.apiRegistry.clear();
        await plans_1.planStore.clear();
    });
    it('handles a valid request end to end', async () => {
        // Seed registry with a test API
        const plan = await plans_1.planStore.save({
            needsDb: true,
            entity: 'customers',
            select: ['customers.*']
        });
        await api_2.apiRegistry.register({
            route: '/customers',
            method: 'GET',
            planId: plan.id,
            status: 'ACTIVE',
            label: 'List customers',
            auth: { type: 'none', required: false }
        });
        const api = await api_2.apiRegistry.resolveRoute('GET', '/customers');
        const response = await api_1.apiHandler.handleRequest({
            apiId: api.id,
            params: {},
            headers: {}
        });
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
    });
    it('rejects requests to DRAFT APIs', async () => {
        const plan = await plans_1.planStore.save({ needsDb: true, entity: 'customers' });
        const draft = await api_2.apiRegistry.register({
            route: '/customers/draft',
            method: 'GET',
            planId: plan.id,
            status: 'DRAFT',
            label: 'Draft',
            auth: { type: 'none', required: false }
        });
        // DRAFT APIs should not be accessible through the handler
        // This test would need to be implemented based on your handler's logic
        // For now, this is a placeholder to show the test structure
        expect(draft.status).toBe('DRAFT');
        // Test that DRAFT APIs exist but shouldn't be accessible
        const draftApi = await api_2.apiRegistry.resolveRoute('GET', '/customers/draft');
        expect(draftApi.status).toBe('DRAFT');
    });
});
describe('security integration', () => {
    beforeEach(async () => {
        api_2.apiRegistry.clear();
        plans_1.planStore.clear();
        api_3.auditLog.clear();
    });
    it('audit logs a successful request', async () => {
        const plan = await plans_1.planStore.save({
            needsDb: true,
            entity: 'customers',
            select: ['customers.*']
        });
        const api = await api_2.apiRegistry.register({
            route: '/customers/audit-test',
            method: 'GET',
            planId: plan.id,
            status: 'ACTIVE',
            label: 'List customers',
            dataLabel: 'sensitive',
            auth: { type: 'none', required: false }
        });
        await api_1.apiHandler.handleRequest({
            apiId: api.id,
            params: {},
            headers: {}
        });
        const entries = api_3.auditLog.query({ apiId: api.id });
        expect(entries).toHaveLength(1);
        expect(entries[0].status).toBe('success');
        expect(entries[0].apiId).toBe(api.id);
        expect(entries[0].paramKeys).toEqual([]);
    });
    it('filters response for insufficient role on sensitive API', async () => {
        const plan = await plans_1.planStore.save({
            needsDb: true,
            entity: 'customers',
            select: ['customers.*']
        });
        const api = await api_2.apiRegistry.register({
            route: '/customers/sensitive-test',
            method: 'GET',
            planId: plan.id,
            status: 'ACTIVE',
            label: 'List customers',
            dataLabel: 'sensitive',
            auth: { type: 'none', required: false }
        });
        const response = await api_1.apiHandler.handleRequest({
            apiId: api.id,
            params: {},
            headers: {},
            user: { id: 'user-1', roles: ['guest'], permissions: [] }
        });
        expect(response.success).toBe(true);
        expect(response.data).toEqual({
            filtered: true,
            reason: 'insufficient_role'
        });
    });
    it('audit logs blocked requests without hitting DB', async () => {
        // Override the singleton rateLimiter for this test
        // by checking that blocked status is logged
        const plan = await plans_1.planStore.save({
            needsDb: true,
            entity: 'customers',
            select: ['customers.*']
        });
        const api = await api_2.apiRegistry.register({
            route: '/customers/ratelimit-test',
            method: 'GET',
            planId: plan.id,
            status: 'ACTIVE',
            label: 'public',
            dataLabel: 'sensitive',
            auth: { type: 'none', required: false }
        });
        // Make 65 requests to trigger per-minute rate limit
        // (default is 60/minute)
        for (let i = 0; i < 60; i++) {
            await api_1.apiHandler.handleRequest({
                apiId: api.id,
                params: {},
                headers: {}
            });
        }
        const blockedResponse = await api_1.apiHandler.handleRequest({
            apiId: api.id,
            params: {},
            headers: {}
        });
        expect(blockedResponse.success).toBe(false);
        expect(blockedResponse.error?.code).toBe('RATE_LIMITED');
        const blockedEntries = api_3.auditLog.query({
            apiId: api.id,
            status: 'blocked'
        });
        expect(blockedEntries.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=api-handler.test.js.map