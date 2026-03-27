"use strict";
// intent/graphParser.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const graphParser_1 = require("../intent/graphParser");
describe('buildPredicate', () => {
    it('creates equals predicate', () => {
        const spec = { op: 'equals', field: 'status', value: 'active' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ status: 'active' })).toBe(true);
        expect(predicate({ status: 'inactive' })).toBe(false);
    });
    it('creates greaterThan predicate', () => {
        const spec = { op: 'greaterThan', field: 'age', value: 25 };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ age: 30 })).toBe(true);
        expect(predicate({ age: 25 })).toBe(false);
        expect(predicate({ age: 20 })).toBe(false);
    });
    it('creates lessThan predicate', () => {
        const spec = { op: 'lessThan', field: 'score', value: 100 };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ score: 85 })).toBe(true);
        expect(predicate({ score: 100 })).toBe(false);
        expect(predicate({ score: 120 })).toBe(false);
    });
    it('creates contains predicate for strings', () => {
        const spec = { op: 'contains', field: 'name', value: 'john' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ name: 'john doe' })).toBe(true);
        expect(predicate({ name: 'jane doe' })).toBe(false);
    });
    it('creates contains predicate for arrays', () => {
        const spec = { op: 'contains', field: 'tags', value: 'urgent' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ tags: ['normal', 'urgent', 'review'] })).toBe(true);
        expect(predicate({ tags: ['normal', 'review'] })).toBe(false);
    });
    it('creates in predicate', () => {
        const spec = { op: 'in', field: 'status', values: ['active', 'pending'] };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ status: 'active' })).toBe(true);
        expect(predicate({ status: 'pending' })).toBe(true);
        expect(predicate({ status: 'inactive' })).toBe(false);
    });
    it('throws IntentParseError for unknown op', () => {
        const spec = { op: 'unknown', field: 'test', value: 'test' };
        expect(() => (0, graphParser_1.buildPredicate)(spec)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.buildPredicate)(spec)).toThrow('Unknown predicate operation: unknown');
    });
    it('creates isNull predicate', () => {
        const spec = { op: 'isNull', field: 'email' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ email: null })).toBe(true);
        expect(predicate({ email: undefined })).toBe(true);
        expect(predicate({ email: 'a@b.com' })).toBe(false);
    });
    it('creates isNotNull predicate', () => {
        const spec = { op: 'isNotNull', field: 'email' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ email: 'a@b.com' })).toBe(true);
        expect(predicate({ email: null })).toBe(false);
        expect(predicate({ email: undefined })).toBe(false);
    });
    it('creates between predicate for numbers', () => {
        const spec = { op: 'between', field: 'amount', low: 100, high: 500 };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ amount: 100 })).toBe(true); // inclusive low
        expect(predicate({ amount: 300 })).toBe(true);
        expect(predicate({ amount: 500 })).toBe(true); // inclusive high
        expect(predicate({ amount: 99 })).toBe(false);
        expect(predicate({ amount: 501 })).toBe(false);
    });
    it('creates between predicate for ISO date strings', () => {
        const spec = {
            op: 'between', field: 'created_at',
            low: '2024-01-01', high: '2024-12-31'
        };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ created_at: '2024-06-15' })).toBe(true);
        expect(predicate({ created_at: '2023-12-31' })).toBe(false);
        expect(predicate({ created_at: '2025-01-01' })).toBe(false);
    });
    it('creates startsWith predicate', () => {
        const spec = { op: 'startsWith', field: 'name', value: 'Raj' };
        const predicate = (0, graphParser_1.buildPredicate)(spec);
        expect(predicate({ name: 'Rajesh' })).toBe(true);
        expect(predicate({ name: 'Rajan' })).toBe(true);
        expect(predicate({ name: 'Arun' })).toBe(false);
        expect(predicate({ name: 123 })).toBe(false); // non-string field
    });
});
describe('resolveTransformNode', () => {
    it('resolves filterRows factory correctly', () => {
        const spec = {
            id: 'filter-active',
            type: 'transform',
            factory: 'filterRows',
            params: {
                dataKey: 'customers',
                predicate: { op: 'equals', field: 'status', value: 'active' }
            }
        };
        const node = (0, graphParser_1.resolveTransformNode)(spec);
        expect(node.id).toBe('filter-active');
        expect(node.type).toBe('transform');
        expect(node.label).toBe('filter-active');
        expect(typeof node.transform).toBe('function');
    });
    it('throws IntentParseError for unknown factory', () => {
        const spec = {
            id: 'unknown-factory',
            type: 'transform',
            factory: 'unknownFactory',
            params: {}
        };
        expect(() => (0, graphParser_1.resolveTransformNode)(spec)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.resolveTransformNode)(spec)).toThrow('Unknown transform factory: unknownFactory');
    });
});
describe('parseIntentGraph', () => {
    it('parses a minimal valid graph', () => {
        const raw = {
            id: 'test-graph',
            label: 'Test Graph',
            entryNode: 'fetch-customers',
            nodes: [
                {
                    id: 'fetch-customers',
                    type: 'query',
                    label: 'Fetch Customers',
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }
            ],
            edges: []
        };
        const graph = (0, graphParser_1.parseIntentGraph)(raw);
        expect(graph.id).toBe('test-graph');
        expect(graph.label).toBe('Test Graph');
        expect(graph.entryNode).toBe('fetch-customers');
        expect(graph.nodes).toHaveLength(1);
        expect(graph.edges).toHaveLength(0);
        expect(graph.nodes[0].id).toBe('fetch-customers');
        expect(graph.nodes[0].type).toBe('query');
    });
    it('throws IntentParseError for missing nodes array', () => {
        const raw = {
            id: 'test-graph',
            label: 'Test Graph',
            entryNode: 'fetch-customers',
            edges: []
        };
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow('Graph must have a nodes array');
    });
    it('resolves transform node with PredicateSpec to real function', () => {
        const raw = {
            id: 'test-graph',
            label: 'Test Graph',
            entryNode: 'filter-active',
            nodes: [
                {
                    id: 'filter-active',
                    type: 'transform',
                    label: 'Filter Active Customers',
                    factory: 'filterRows',
                    params: {
                        dataKey: 'customers',
                        predicate: { op: 'equals', field: 'status', value: 'active' }
                    }
                }
            ],
            edges: []
        };
        const graph = (0, graphParser_1.parseIntentGraph)(raw);
        expect(graph.nodes[0].type).toBe('transform');
        expect(typeof graph.nodes[0].transform).toBe('function');
        // Test that the predicate was converted to a real function
        const transformNode = graph.nodes[0];
        if (transformNode.transform) {
            const testData = {
                customers: {
                    rows: [
                        { status: 'active', name: 'John' },
                        { status: 'inactive', name: 'Jane' }
                    ],
                    fields: ['status', 'name']
                }
            };
            const result = transformNode.transform(testData);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].status).toBe('active');
        }
    });
    it('throws IntentParseError for non-object input', () => {
        expect(() => (0, graphParser_1.parseIntentGraph)(null)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.parseIntentGraph)('string')).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.parseIntentGraph)(123)).toThrow(graphParser_1.IntentParseError);
    });
    it('throws IntentParseError for query node with missing plan', () => {
        const raw = {
            id: 'test-graph', label: 'Test', entryNode: 'fetch',
            nodes: [{ id: 'fetch', type: 'query', label: 'Fetch' }],
            edges: []
        };
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow('missing a plan object');
    });
    it('throws IntentParseError for query node referencing nonexistent table', () => {
        const raw = {
            id: 'test-graph', label: 'Test', entryNode: 'fetch',
            nodes: [{
                    id: 'fetch', type: 'query', label: 'Fetch',
                    plan: { needsDb: true, entity: 'nonexistent_table', select: ['nonexistent_table.*'] }
                }],
            edges: []
        };
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow(graphParser_1.IntentParseError);
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).toThrow('invalid QueryPlan');
    });
    it('accepts query node with valid QueryPlan', () => {
        const raw = {
            id: 'test-graph', label: 'Test', entryNode: 'fetch',
            nodes: [{
                    id: 'fetch', type: 'query', label: 'Fetch Customers',
                    plan: { needsDb: true, entity: 'customers', select: ['customers.*'] }
                }],
            edges: []
        };
        expect(() => (0, graphParser_1.parseIntentGraph)(raw)).not.toThrow();
        const graph = (0, graphParser_1.parseIntentGraph)(raw);
        expect(graph.nodes[0].id).toBe('fetch');
    });
});
//# sourceMappingURL=graphParser.test.js.map