"use strict";
// src/graph/nodes/transform.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const transform_1 = require("../graph/nodes/transform");
const customers = {
    rows: [
        { id: 1, name: 'Ravi', city: 'Chennai', score: 85 },
        { id: 2, name: 'Priya', city: 'Mumbai', score: 92 },
        { id: 3, name: 'Karthik', city: 'Chennai', score: 78 },
        { id: 4, name: 'Anu', city: 'Bangalore', score: 95 },
    ],
    fields: ['id', 'name', 'city', 'score']
};
const orders = {
    rows: [
        { id: 101, customer_id: 1, amount: 500 },
        { id: 102, customer_id: 1, amount: 300 },
        { id: 103, customer_id: 2, amount: 1200 },
        { id: 104, customer_id: 3, amount: 450 },
    ],
    fields: ['id', 'customer_id', 'amount']
};
describe('Transform Node Factories', () => {
    describe('mergeByKey', () => {
        it('joins customers with orders correctly', () => {
            const node = (0, transform_1.mergeByKey)({
                id: 'merge',
                label: 'Merge customers with orders',
                leftKey: 'customers',
                rightKey: 'orders',
                on: 'id',
                foreignKey: 'customer_id',
                outputField: 'orders'
            });
            const result = node.transform({ customers, orders });
            expect(result.rows).toHaveLength(4);
            // Ravi should have 2 orders
            const ravi = result.rows.find((row) => row.id === 1);
            expect(ravi?.orders).toHaveLength(2);
            expect(ravi?.orders).toEqual([
                { id: 101, customer_id: 1, amount: 500 },
                { id: 102, customer_id: 1, amount: 300 }
            ]);
            // Priya should have 1 order
            const priya = result.rows.find((row) => row.id === 2);
            expect(priya?.orders).toHaveLength(1);
            expect(priya?.orders).toEqual([
                { id: 103, customer_id: 2, amount: 1200 }
            ]);
            // Anu should have 0 orders (empty array, not undefined)
            const anu = result.rows.find((row) => row.id === 4);
            expect(anu?.orders).toEqual([]);
            // Output fields should include 'orders'
            expect(result.fields).toContain('orders');
        });
        it('handles missing input key', () => {
            const node = (0, transform_1.mergeByKey)({
                id: 'merge',
                label: 'Merge customers with orders',
                leftKey: 'customers',
                rightKey: 'orders',
                on: 'id',
                foreignKey: 'customer_id',
                outputField: 'orders'
            });
            const result = node.transform({});
            expect(result.rows).toEqual([]);
            expect(result.fields).toContain('orders');
        });
    });
    describe('filterRows', () => {
        it('filters by city correctly', () => {
            const node = (0, transform_1.filterRows)({
                id: 'filter',
                label: 'Filter Chennai',
                dataKey: 'customers',
                predicate: row => row.city === 'Chennai'
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(2);
            expect(result.rows.map((row) => row.name)).toEqual(['Ravi', 'Karthik']);
            expect(result.fields).toEqual(customers.fields);
        });
        it('filters by score correctly', () => {
            const node = (0, transform_1.filterRows)({
                id: 'filter',
                label: 'Filter high scores',
                dataKey: 'customers',
                predicate: row => row.score > 90
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(2);
            expect(result.rows.map((row) => row.name)).toEqual(['Priya', 'Anu']);
        });
        it('returns empty rows when nothing matches', () => {
            const node = (0, transform_1.filterRows)({
                id: 'filter',
                label: 'Filter non-existent',
                dataKey: 'customers',
                predicate: row => row.city === 'Delhi'
            });
            const result = node.transform({ customers });
            expect(result.rows).toEqual([]);
            expect(result.fields).toEqual(customers.fields);
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.filterRows)({
                id: 'filter',
                label: 'Filter',
                dataKey: 'customers',
                predicate: row => row.city === 'Chennai'
            });
            const result = node.transform({});
            expect(result).toEqual({ rows: [], fields: [] });
        });
    });
    describe('pickFields', () => {
        it('picks specified fields correctly', () => {
            const node = (0, transform_1.pickFields)({
                id: 'pick',
                label: 'Pick id and name',
                dataKey: 'customers',
                fields: ['id', 'name']
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(4);
            result.rows.forEach((row) => {
                expect(Object.keys(row)).toEqual(['id', 'name']);
                expect(row).toEqual({
                    id: expect.any(Number),
                    name: expect.any(String)
                });
            });
            expect(result.fields).toEqual(['id', 'name']);
        });
        it('does not mutate original rows', () => {
            const originalCustomers = JSON.parse(JSON.stringify(customers));
            const node = (0, transform_1.pickFields)({
                id: 'pick',
                label: 'Pick id and name',
                dataKey: 'customers',
                fields: ['id', 'name']
            });
            node.transform({ customers });
            expect(customers).toEqual(originalCustomers);
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.pickFields)({
                id: 'pick',
                label: 'Pick fields',
                dataKey: 'customers',
                fields: ['id', 'name']
            });
            const result = node.transform({});
            expect(result.rows).toEqual([]);
            expect(result.fields).toEqual(['id', 'name']);
        });
    });
    describe('mapRows', () => {
        it('applies mapper function correctly', () => {
            const node = (0, transform_1.mapRows)({
                id: 'map',
                label: 'Add fullLabel',
                dataKey: 'customers',
                mapper: row => ({
                    ...row,
                    fullLabel: `${row.name} (${row.city})`
                })
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(4);
            const ravi = result.rows.find((row) => row.id === 1);
            expect(ravi?.fullLabel).toBe('Ravi (Chennai)');
            expect(result.fields).toEqual(customers.fields);
        });
        it('does not mutate original rows', () => {
            const originalCustomers = JSON.parse(JSON.stringify(customers));
            const node = (0, transform_1.mapRows)({
                id: 'map',
                label: 'Add field',
                dataKey: 'customers',
                mapper: row => ({ ...row, newField: 'test' })
            });
            node.transform({ customers });
            expect(customers).toEqual(originalCustomers);
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.mapRows)({
                id: 'map',
                label: 'Map rows',
                dataKey: 'customers',
                mapper: row => row
            });
            const result = node.transform({});
            expect(result).toEqual({ rows: [], fields: [] });
        });
    });
    describe('sortRows', () => {
        it('sorts by name ascending', () => {
            const node = (0, transform_1.sortRows)({
                id: 'sort',
                label: 'Sort by name',
                dataKey: 'customers',
                field: 'name',
                direction: 'asc'
            });
            const result = node.transform({ customers });
            expect(result.rows.map((row) => row.name)).toEqual(['Anu', 'Karthik', 'Priya', 'Ravi']);
            expect(result.fields).toEqual(customers.fields);
        });
        it('sorts by score descending', () => {
            const node = (0, transform_1.sortRows)({
                id: 'sort',
                label: 'Sort by score',
                dataKey: 'customers',
                field: 'score',
                direction: 'desc'
            });
            const result = node.transform({ customers });
            expect(result.rows.map((row) => row.name)).toEqual(['Anu', 'Priya', 'Ravi', 'Karthik']);
            expect(result.rows.map((row) => row.score)).toEqual([95, 92, 85, 78]);
        });
        it('handles null values correctly', () => {
            const dataWithNulls = {
                rows: [
                    { id: 1, name: 'Ravi', city: null, score: 85 },
                    { id: 2, name: 'Priya', city: 'Mumbai', score: 92 },
                    { id: 3, name: 'Karthik', city: undefined, score: 78 },
                    { id: 4, name: 'Anu', city: 'Bangalore', score: 95 },
                ],
                fields: ['id', 'name', 'city', 'score']
            };
            const node = (0, transform_1.sortRows)({
                id: 'sort',
                label: 'Sort by city',
                dataKey: 'data',
                field: 'city',
                direction: 'asc'
            });
            const result = node.transform({ data: dataWithNulls });
            const sortedNames = result.rows.map((row) => row.name);
            // Non-null values should come first, sorted alphabetically
            expect(sortedNames.slice(0, 2)).toEqual(['Anu', 'Priya']);
            // Null/undefined values should come last
            expect(sortedNames.slice(2)).toEqual(['Ravi', 'Karthik']);
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.sortRows)({
                id: 'sort',
                label: 'Sort',
                dataKey: 'customers',
                field: 'name',
                direction: 'asc'
            });
            const result = node.transform({});
            expect(result).toEqual({ rows: [], fields: [] });
        });
    });
    describe('limitRows', () => {
        it('limits to specified number', () => {
            const node = (0, transform_1.limitRows)({
                id: 'limit',
                label: 'Limit rows',
                dataKey: 'customers',
                n: 2
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(2);
            expect(result.rows.map((row) => row.name)).toEqual(['Ravi', 'Priya']);
            expect(result.fields).toEqual(customers.fields);
        });
        it('handles limit larger than dataset', () => {
            const node = (0, transform_1.limitRows)({
                id: 'limit',
                label: 'Limit rows',
                dataKey: 'customers',
                n: 10
            });
            const result = node.transform({ customers });
            expect(result.rows).toHaveLength(4);
            expect(result.rows).toEqual(customers.rows);
        });
        it('handles limit of 0', () => {
            const node = (0, transform_1.limitRows)({
                id: 'limit',
                label: 'Limit rows',
                dataKey: 'customers',
                n: 0
            });
            const result = node.transform({ customers });
            expect(result.rows).toEqual([]);
            expect(result.fields).toEqual(customers.fields);
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.limitRows)({
                id: 'limit',
                label: 'Limit rows',
                dataKey: 'customers',
                n: 2
            });
            const result = node.transform({});
            expect(result).toEqual({ rows: [], fields: [] });
        });
    });
    describe('aggregateRows', () => {
        it('aggregates without groupBy correctly', () => {
            const node = (0, transform_1.aggregateRows)({
                id: 'aggregate',
                label: 'Aggregate all orders',
                dataKey: 'orders',
                aggregations: {
                    amount: { count: true, sum: true, avg: true }
                }
            });
            const result = node.transform({ orders });
            expect(result.rows).toHaveLength(1);
            const row = result.rows[0];
            expect(row.amount_count).toBe(4);
            expect(row.amount_sum).toBe(2450);
            expect(row.amount_avg).toBe(612.5);
        });
        it('aggregates with groupBy correctly', () => {
            const customersWithCity = {
                rows: [
                    { id: 1, name: 'Ravi', city: 'Chennai', score: 85 },
                    { id: 2, name: 'Priya', city: 'Mumbai', score: 92 },
                    { id: 3, name: 'Karthik', city: 'Chennai', score: 78 },
                    { id: 4, name: 'Anu', city: 'Bangalore', score: 95 },
                ],
                fields: ['id', 'name', 'city', 'score']
            };
            const node = (0, transform_1.aggregateRows)({
                id: 'aggregate',
                label: 'Aggregate by city',
                dataKey: 'data',
                groupBy: ['city'],
                aggregations: {
                    score: { count: true, avg: true }
                }
            });
            const result = node.transform({ data: customersWithCity });
            expect(result.rows).toHaveLength(3);
            // Check Chennai aggregation
            const chennai = result.rows.find((row) => row.city === 'Chennai');
            expect(chennai?.score_count).toBe(2);
            expect(chennai?.score_avg).toBe(81.5); // (85 + 78) / 2
            // Check Mumbai aggregation
            const mumbai = result.rows.find((row) => row.city === 'Mumbai');
            expect(mumbai?.score_count).toBe(1);
            expect(mumbai?.score_avg).toBe(92);
            // Check Bangalore aggregation
            const bangalore = result.rows.find((row) => row.city === 'Bangalore');
            expect(bangalore?.score_count).toBe(1);
            expect(bangalore?.score_avg).toBe(95);
        });
        it('groupKey does NOT appear in output rows', () => {
            const node = (0, transform_1.aggregateRows)({
                id: 'aggregate',
                label: 'Aggregate by city',
                dataKey: 'customers',
                groupBy: ['city'],
                aggregations: {
                    id: { count: true }
                }
            });
            const result = node.transform({ customers });
            result.rows.forEach((row) => {
                expect(row).not.toHaveProperty('groupKey');
                expect(row).toHaveProperty('city');
            });
        });
        it('groupBy fields DO appear in output rows', () => {
            const node = (0, transform_1.aggregateRows)({
                id: 'aggregate',
                label: 'Aggregate by city and name',
                dataKey: 'customers',
                groupBy: ['city', 'name'],
                aggregations: {
                    id: { count: true }
                }
            });
            const result = node.transform({ customers });
            const raviRow = result.rows.find((row) => row.name === 'Ravi' && row.city === 'Chennai');
            expect(raviRow).toHaveProperty('city', 'Chennai');
            expect(raviRow).toHaveProperty('name', 'Ravi');
            expect(raviRow).not.toHaveProperty('groupKey');
        });
        it('handles missing dataKey', () => {
            const node = (0, transform_1.aggregateRows)({
                id: 'aggregate',
                label: 'Aggregate',
                dataKey: 'customers',
                aggregations: {
                    id: { count: true }
                }
            });
            const result = node.transform({});
            expect(result.rows).toEqual([{ id_count: 0 }]);
            expect(result.fields).toContain('id_count');
        });
    });
});
//# sourceMappingURL=transform.test.js.map