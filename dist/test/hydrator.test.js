"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test/hydrator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
const api_1 = require("../api");
describe('hydratePlan', () => {
    it('injects :param references into WHERE conditions', async () => {
        const plan = {
            needsDb: true,
            entity: 'customers',
            where: [{ field: 'customers.city', op: '=', value: ':city' }]
        };
        const api = {
            id: 'test',
            route: '/test',
            method: 'GET',
            planId: 'test-plan',
            status: 'ACTIVE',
            label: 'Test API',
            params: [{ name: 'city', type: 'string', required: true, source: 'query' }],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await api_1.planHydrator.hydrate({ plan, params: { city: 'Chennai' }, api });
        expect(result.hydratedPlan.where[0].value).toBe('Chennai');
    });
    it('throws on missing required param', async () => {
        const plan = {
            needsDb: true,
            entity: 'customers',
            where: [{ field: 'customers.city', op: '=', value: ':city' }]
        };
        const api = {
            id: 'test',
            route: '/test',
            method: 'GET',
            planId: 'test-plan',
            status: 'ACTIVE',
            label: 'Test API',
            params: [{ name: 'city', type: 'string', required: true, source: 'query' }],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await expect(api_1.planHydrator.hydrate({ plan, params: {}, api }))
            .rejects.toThrow('Required parameter');
    });
});
//# sourceMappingURL=hydrator.test.js.map