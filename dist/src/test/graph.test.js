"use strict";
// src/test/graph.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const graph_1 = require("../graph");
const runtime = new graph_1.GraphRuntime();
describe('GraphRuntime', () => {
    it('validates a well-formed graph', async () => {
        const graph = {
            id: 'test-graph',
            label: 'Test',
            entryNode: 'fetch-customers',
            nodes: [
                {
                    id: 'fetch-customers',
                    type: 'query',
                    label: 'Fetch customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }
            ],
            edges: []
        };
        const result = await runtime.execute(graph, { dryRun: true });
        expect(result.success).toBe(true);
    });
    it('catches duplicate node ids', async () => {
        const graph = {
            id: 'bad-graph',
            label: 'Bad',
            entryNode: 'node-a',
            nodes: [
                { id: 'node-a', type: 'query', label: 'A',
                    plan: { needsDb: true, entity: 'customers' } },
                { id: 'node-a', type: 'query', label: 'A-dup',
                    plan: { needsDb: true, entity: 'customers' } },
            ],
            edges: []
        };
        const result = await runtime.execute(graph, { dryRun: true });
        expect(result.success).toBe(false);
    });
    it('catches missing entry node', async () => {
        const graph = {
            id: 'bad-graph',
            label: 'Bad',
            entryNode: 'does-not-exist',
            nodes: [
                { id: 'node-a', type: 'query', label: 'A',
                    plan: { needsDb: true, entity: 'customers' } }
            ],
            edges: []
        };
        const result = await runtime.execute(graph, { dryRun: true });
        expect(result.success).toBe(false);
    });
    it('executes a single query node against real DB', async () => {
        const graph = {
            id: 'single-query',
            label: 'Single query',
            entryNode: 'fetch-customers',
            nodes: [
                {
                    id: 'fetch-customers',
                    type: 'query',
                    label: 'Fetch customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }
            ],
            edges: []
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.finalOutput?.rows)).toBe(true);
        expect(result.finalOutput?.fields).toBeDefined();
    });
    it('passes data between nodes via dataKey', async () => {
        const graph = {
            id: 'two-node',
            label: 'Fetch and transform',
            entryNode: 'fetch-customers',
            nodes: [
                {
                    id: 'fetch-customers',
                    type: 'query',
                    label: 'Fetch customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                },
                {
                    id: 'count-results',
                    type: 'transform',
                    label: 'Count results',
                    transform: (input) => {
                        const count = input.customers?.rows?.length ?? 0;
                        return { count };
                    }
                }
            ],
            edges: [
                { from: 'fetch-customers', to: 'count-results', dataKey: 'customers' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.count).toBe(10); // Mock DB returns 10 rows
    });
    it('marks skipped branch on condition node', async () => {
        const graph = {
            id: 'condition-graph',
            label: 'Condition test',
            entryNode: 'check',
            nodes: [
                {
                    id: 'check',
                    type: 'condition',
                    label: 'Always true',
                    condition: () => true,
                    trueBranch: 'branch-true',
                    falseBranch: 'branch-false'
                },
                {
                    id: 'branch-true',
                    type: 'transform',
                    label: 'True branch',
                    transform: () => ({ path: 'true' })
                },
                {
                    id: 'branch-false',
                    type: 'transform',
                    label: 'False branch',
                    transform: () => ({ path: 'false' })
                }
            ],
            edges: [
                { from: 'check', to: 'branch-true' },
                { from: 'check', to: 'branch-false' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.nodeResults.get('branch-false')?.skipped).toBe(true);
        expect(result.nodeResults.get('branch-true')?.skipped).toBeUndefined();
    });
});
//# sourceMappingURL=graph.test.js.map