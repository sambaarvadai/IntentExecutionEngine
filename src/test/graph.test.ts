// src/test/graph.test.ts

import { GraphRuntime, ExecutionGraph } from '../graph'

// Mock database for graph tests
jest.mock('../db/sqlite', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn((sql: string, params: any[]) => {
      // Return 10 mock rows for accounts queries
      if (sql.includes('accounts')) {
        return [
          { id: 1, name: 'Ravi', city: 'Chennai', score: 85 },
          { id: 2, name: 'Priya', city: 'Mumbai', score: 92 },
          { id: 3, name: 'Karthik', city: 'Chennai', score: 78 },
          { id: 4, name: 'Anu', city: 'Bangalore', score: 95 },
          { id: 5, name: 'Vijay', city: 'Delhi', score: 88 },
          { id: 6, name: 'Deepak', city: 'Pune', score: 82 },
          { id: 7, name: 'Sneha', city: 'Hyderabad', score: 90 },
          { id: 8, name: 'Amit', city: 'Kolkata', score: 87 },
          { id: 9, name: 'Neha', city: 'Chennai', score: 93 },
          { id: 10, name: 'Rohit', city: 'Mumbai', score: 79 }
        ]
      }
      return []
    }),
    close: jest.fn()
  }))
}));

const runtime = new GraphRuntime()

describe('GraphRuntime', () => {

  it('validates a well-formed graph', async () => {
    const graph: ExecutionGraph = {
      id: 'test-graph',
      label: 'Test',
      entryNode: 'fetch-accounts',
      nodes: [
        {
          id: 'fetch-accounts',
          type: 'query',
          label: 'Fetch accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        }
      ],
      edges: []
    }
    const result = await runtime.execute(graph, { dryRun: true })
    expect(result.success).toBe(true)
  })

  it('catches duplicate node ids', async () => {
    const graph: ExecutionGraph = {
      id: 'bad-graph',
      label: 'Bad',
      entryNode: 'node-a',
      nodes: [
        { id: 'node-a', type: 'query', label: 'A',
          plan: { needsDb: true, entity: 'accounts' } },
        { id: 'node-a', type: 'query', label: 'A-dup',
          plan: { needsDb: true, entity: 'accounts' } },
      ],
      edges: []
    }
    const result = await runtime.execute(graph, { dryRun: true })
    expect(result.success).toBe(false)
  })

  it('catches missing entry node', async () => {
    const graph: ExecutionGraph = {
      id: 'bad-graph',
      label: 'Bad',
      entryNode: 'does-not-exist',
      nodes: [
        { id: 'node-a', type: 'query', label: 'A',
          plan: { needsDb: true, entity: 'accounts' } }
      ],
      edges: []
    }
    const result = await runtime.execute(graph, { dryRun: true })
    expect(result.success).toBe(false)
  })

  it('executes a single query node against real DB', async () => {
    const graph: ExecutionGraph = {
      id: 'single-query',
      label: 'Single query',
      entryNode: 'fetch-accounts',
      nodes: [
        {
          id: 'fetch-accounts',
          type: 'query',
          label: 'Fetch accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        }
      ],
      edges: []
    }
    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(Array.isArray(result.finalOutput?.rows)).toBe(true)
    expect(result.finalOutput?.fields).toBeDefined()
  })

  it('passes data between nodes via dataKey', async () => {
    const graph: ExecutionGraph = {
      id: 'two-node',
      label: 'Fetch and transform',
      entryNode: 'fetch-accounts',
      nodes: [
        {
          id: 'fetch-accounts',
          type: 'query',
          label: 'Fetch accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        },
        {
          id: 'count-results',
          type: 'transform',
          label: 'Count results',
          transform: (input) => {
            const count = input.accounts?.rows?.length ?? 0;
            return { count };
          }
        }
      ],
      edges: [
        { from: 'fetch-accounts', to: 'count-results', dataKey: 'accounts' }
      ]
    }
    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.count).toBe(10) // Mock DB returns 10 rows
  })

  it('marks skipped branch on condition node', async () => {
    const graph: ExecutionGraph = {
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
    }
    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.nodeResults.get('branch-false')?.skipped).toBe(true)
    expect(result.nodeResults.get('branch-true')?.skipped).toBeUndefined()
  })

})
