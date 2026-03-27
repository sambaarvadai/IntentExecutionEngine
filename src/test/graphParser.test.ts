// intent/graphParser.test.ts

import { 
  buildPredicate, 
  resolveTransformNode, 
  parseIntentGraph,
  IntentParseError 
} from '../intent/graphParser';

import { 
  EqualsPredicate,
  GreaterThanPredicate,
  LessThanPredicate,
  ContainsPredicate,
  InPredicate,
  IsNullPredicate,
  IsNotNullPredicate,
  BetweenPredicate,
  StartsWithPredicate,
  NodeFactorySpec
} from '../intent/types';

describe('buildPredicate', () => {
  it('creates equals predicate', () => {
    const spec: EqualsPredicate = { op: 'equals', field: 'status', value: 'active' };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ status: 'active' })).toBe(true);
    expect(predicate({ status: 'inactive' })).toBe(false);
  });

  it('creates greaterThan predicate', () => {
    const spec: GreaterThanPredicate = { op: 'greaterThan', field: 'age', value: 25 };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ age: 30 })).toBe(true);
    expect(predicate({ age: 25 })).toBe(false);
    expect(predicate({ age: 20 })).toBe(false);
  });

  it('creates lessThan predicate', () => {
    const spec: LessThanPredicate = { op: 'lessThan', field: 'score', value: 100 };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ score: 85 })).toBe(true);
    expect(predicate({ score: 100 })).toBe(false);
    expect(predicate({ score: 120 })).toBe(false);
  });

  it('creates contains predicate for strings', () => {
    const spec: ContainsPredicate = { op: 'contains', field: 'name', value: 'john' };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ name: 'john doe' })).toBe(true);
    expect(predicate({ name: 'jane doe' })).toBe(false);
  });

  it('creates contains predicate for arrays', () => {
    const spec: ContainsPredicate = { op: 'contains', field: 'tags', value: 'urgent' };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ tags: ['normal', 'urgent', 'review'] })).toBe(true);
    expect(predicate({ tags: ['normal', 'review'] })).toBe(false);
  });

  it('creates in predicate', () => {
    const spec: InPredicate = { op: 'in', field: 'status', values: ['active', 'pending'] };
    const predicate = buildPredicate(spec);
    
    expect(predicate({ status: 'active' })).toBe(true);
    expect(predicate({ status: 'pending' })).toBe(true);
    expect(predicate({ status: 'inactive' })).toBe(false);
  });

  it('throws IntentParseError for unknown op', () => {
    const spec = { op: 'unknown', field: 'test', value: 'test' } as any;
    
    expect(() => buildPredicate(spec)).toThrow(IntentParseError);
    expect(() => buildPredicate(spec)).toThrow('Unknown predicate operation: unknown');
  });

  it('creates isNull predicate', () => {
    const spec: IsNullPredicate = { op: 'isNull', field: 'email' };
    const predicate = buildPredicate(spec);
    expect(predicate({ email: null })).toBe(true);
    expect(predicate({ email: undefined })).toBe(true);
    expect(predicate({ email: 'a@b.com' })).toBe(false);
  });

  it('creates isNotNull predicate', () => {
    const spec: IsNotNullPredicate = { op: 'isNotNull', field: 'email' };
    const predicate = buildPredicate(spec);
    expect(predicate({ email: 'a@b.com' })).toBe(true);
    expect(predicate({ email: null })).toBe(false);
    expect(predicate({ email: undefined })).toBe(false);
  });

  it('creates between predicate for numbers', () => {
    const spec: BetweenPredicate = { op: 'between', field: 'amount', low: 100, high: 500 };
    const predicate = buildPredicate(spec);
    expect(predicate({ amount: 100 })).toBe(true);   // inclusive low
    expect(predicate({ amount: 300 })).toBe(true);
    expect(predicate({ amount: 500 })).toBe(true);   // inclusive high
    expect(predicate({ amount: 99 })).toBe(false);
    expect(predicate({ amount: 501 })).toBe(false);
  });

  it('creates between predicate for ISO date strings', () => {
    const spec: BetweenPredicate = { 
      op: 'between', field: 'created_at', 
      low: '2024-01-01', high: '2024-12-31' 
    };
    const predicate = buildPredicate(spec);
    expect(predicate({ created_at: '2024-06-15' })).toBe(true);
    expect(predicate({ created_at: '2023-12-31' })).toBe(false);
    expect(predicate({ created_at: '2025-01-01' })).toBe(false);
  });

  it('creates startsWith predicate', () => {
    const spec: StartsWithPredicate = { op: 'startsWith', field: 'name', value: 'Raj' };
    const predicate = buildPredicate(spec);
    expect(predicate({ name: 'Rajesh' })).toBe(true);
    expect(predicate({ name: 'Rajan' })).toBe(true);
    expect(predicate({ name: 'Arun' })).toBe(false);
    expect(predicate({ name: 123 })).toBe(false); // non-string field
  });
});

describe('resolveTransformNode', () => {
  it('resolves filterRows factory correctly', () => {
    const spec: NodeFactorySpec = {
      id: 'filter-active',
      type: 'transform',
      factory: 'filterRows',
      params: {
        dataKey: 'customers',
        predicate: { op: 'equals', field: 'status', value: 'active' }
      }
    };

    const node = resolveTransformNode(spec);
    
    expect(node.id).toBe('filter-active');
    expect(node.type).toBe('transform');
    expect(node.label).toBe('filter-active');
    expect(typeof node.transform).toBe('function');
  });

  it('throws IntentParseError for unknown factory', () => {
    const spec: NodeFactorySpec = {
      id: 'unknown-factory',
      type: 'transform',
      factory: 'unknownFactory',
      params: {}
    };

    expect(() => resolveTransformNode(spec)).toThrow(IntentParseError);
    expect(() => resolveTransformNode(spec)).toThrow('Unknown transform factory: unknownFactory');
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

    const graph = parseIntentGraph(raw);
    
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

    expect(() => parseIntentGraph(raw)).toThrow(IntentParseError);
    expect(() => parseIntentGraph(raw)).toThrow('Graph must have a nodes array');
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

    const graph = parseIntentGraph(raw);
    
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
    expect(() => parseIntentGraph(null)).toThrow(IntentParseError);
    expect(() => parseIntentGraph('string')).toThrow(IntentParseError);
    expect(() => parseIntentGraph(123)).toThrow(IntentParseError);
  });

  it('throws IntentParseError for query node with missing plan', () => {
    const raw = {
      id: 'test-graph', label: 'Test', entryNode: 'fetch',
      nodes: [{ id: 'fetch', type: 'query', label: 'Fetch' }],
      edges: []
    };
    expect(() => parseIntentGraph(raw)).toThrow(IntentParseError);
    expect(() => parseIntentGraph(raw)).toThrow('missing a plan object');
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
    expect(() => parseIntentGraph(raw)).toThrow(IntentParseError);
    expect(() => parseIntentGraph(raw)).toThrow('invalid QueryPlan');
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
    expect(() => parseIntentGraph(raw)).not.toThrow();
    const graph = parseIntentGraph(raw);
    expect(graph.nodes[0].id).toBe('fetch');
  });
});
