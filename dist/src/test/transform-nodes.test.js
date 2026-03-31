"use strict";
// src/test/transform-nodes.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const transform_1 = require("../graph/nodes/transform");
const graph_1 = require("../graph");
const runtime = new graph_1.GraphRuntime();
describe('Transform Nodes', () => {
    it('mergeByKey joins two datasets', async () => {
        const graph = {
            id: 'merge-test',
            label: 'Merge Test',
            entryNode: 'merge',
            nodes: [
                {
                    id: 'customers',
                    type: 'query',
                    label: 'Get customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                },
                {
                    id: 'orders',
                    type: 'query',
                    label: 'Get orders',
                    plan: {
                        needsDb: true,
                        entity: 'orders',
                        select: ['orders.*']
                    }
                },
                (0, transform_1.mergeByKey)({
                    id: 'merge',
                    label: 'Merge customers with orders',
                    leftKey: 'customers',
                    rightKey: 'orders',
                    on: 'id',
                    foreignKey: 'customer_id',
                    outputField: 'orders'
                })
            ],
            edges: [
                { from: 'customers', to: 'merge', dataKey: 'customers' },
                { from: 'orders', to: 'merge', dataKey: 'orders' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.rows).toBeDefined();
    });
    it('filterRows filters dataset', async () => {
        const graph = {
            id: 'filter-test',
            label: 'Filter Test',
            entryNode: 'customers',
            nodes: [
                {
                    id: 'customers',
                    type: 'query',
                    label: 'Get customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                },
                (0, transform_1.filterRows)({
                    id: 'filter-chennai',
                    label: 'Filter Chennai customers',
                    dataKey: 'customers',
                    predicate: (row) => row.city === 'Chennai'
                })
            ],
            edges: [
                { from: 'customers', to: 'filter-chennai', dataKey: 'customers' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.rows).toBeDefined();
    });
    it('pickFields selects specific fields', async () => {
        const graph = {
            id: 'pick-test',
            label: 'Pick Fields Test',
            entryNode: 'customers',
            nodes: [
                {
                    id: 'customers',
                    type: 'query',
                    label: 'Get customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                },
                (0, transform_1.pickFields)({
                    id: 'pick-name-city',
                    label: 'Pick name and city',
                    dataKey: 'customers',
                    fields: ['name', 'city']
                })
            ],
            edges: [
                { from: 'customers', to: 'pick-name-city', dataKey: 'customers' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.fields).toEqual(['name', 'city']);
    });
    it('sortRows sorts dataset', async () => {
        const graph = {
            id: 'sort-test',
            label: 'Sort Test',
            entryNode: 'customers',
            nodes: [
                {
                    id: 'customers',
                    type: 'query',
                    label: 'Get customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                },
                (0, transform_1.sortRows)({
                    id: 'sort-by-name',
                    label: 'Sort by name',
                    dataKey: 'customers',
                    field: 'name',
                    direction: 'asc'
                })
            ],
            edges: [
                { from: 'customers', to: 'sort-by-name', dataKey: 'customers' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.rows).toBeDefined();
    });
    it('aggregateRows performs aggregations', async () => {
        const graph = {
            id: 'aggregate-test',
            label: 'Aggregate Test',
            entryNode: 'orders',
            nodes: [
                {
                    id: 'orders',
                    type: 'query',
                    label: 'Get orders',
                    plan: {
                        needsDb: true,
                        entity: 'orders',
                        select: ['orders.*']
                    }
                },
                (0, transform_1.aggregateRows)({
                    id: 'aggregate-by-customer',
                    label: 'Aggregate orders by customer',
                    dataKey: 'orders',
                    groupBy: ['customer_id'],
                    aggregations: {
                        amount: { count: true, sum: true, avg: true },
                        customer_id: { count: true }
                    }
                })
            ],
            edges: [
                { from: 'orders', to: 'aggregate-by-customer', dataKey: 'orders' }
            ]
        };
        const result = await runtime.execute(graph);
        expect(result.success).toBe(true);
        expect(result.finalOutput?.rows).toBeDefined();
    });
});
//# sourceMappingURL=transform-nodes.test.js.map