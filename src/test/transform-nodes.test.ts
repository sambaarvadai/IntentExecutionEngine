// src/test/transform-nodes.test.ts

import { mergeByKey, filterRows, pickFields, mapRows, sortRows, aggregateRows } from '../graph/nodes/transform'
import { GraphRuntime, ExecutionNode, ExecutionNodeType } from '../graph'

// Mock database for transform nodes tests
jest.mock('../db/sqlite', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn((sql: string, params: any[]) => {
      // Return mock data for accounts queries
      if (sql.includes('accounts')) {
        return [
          { id: 1, name: 'Ravi', city: 'Chennai', score: 85 },
          { id: 2, name: 'Priya', city: 'Mumbai', score: 92 },
          { id: 3, name: 'Karthik', city: 'Chennai', score: 78 },
          { id: 4, name: 'Anu', city: 'Bangalore', score: 95 }
        ]
      }
      // Return mock data for opportunities queries
      if (sql.includes('opportunities')) {
        return [
          { id: 101, account_id: 1, amount: 500, stage: 'proposal' },
          { id: 102, account_id: 1, amount: 300, stage: 'negotiation' },
          { id: 103, account_id: 2, amount: 1200, stage: 'proposal' },
          { id: 104, account_id: 3, amount: 450, stage: 'closed_won' }
        ]
      }
      return []
    }),
    close: jest.fn()
  }))
}));

const runtime = new GraphRuntime()

describe('Transform Nodes', () => {

  it('mergeByKey joins two datasets', async () => {
    const graph = {
      id: 'merge-test',
      label: 'Merge Test',
      entryNode: 'merge',
      nodes: [
        {
          id: 'accounts',
          type: 'query' as ExecutionNodeType,
          label: 'Get accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        },
        {
          id: 'opportunities',
          type: 'query' as ExecutionNodeType,
          label: 'Get opportunities',
          plan: {
            needsDb: true,
            entity: 'opportunities',
            select: ['opportunities.*']
          }
        },
        mergeByKey({
          id: 'merge',
          label: 'Merge accounts with opportunities',
          leftKey: 'accounts',
          rightKey: 'opportunities',
          on: 'id',
          foreignKey: 'account_id',
          outputField: 'opportunities'
        })
      ],
      edges: [
        { from: 'accounts', to: 'merge', dataKey: 'accounts' },
        { from: 'opportunities', to: 'merge', dataKey: 'opportunities' }
      ]
    }

    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.rows).toBeDefined()
  })

  it('filterRows filters dataset', async () => {
    const graph = {
      id: 'filter-test',
      label: 'Filter Test',
      entryNode: 'accounts',
      nodes: [
        {
          id: 'accounts',
          type: 'query' as ExecutionNodeType,
          label: 'Get accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        },
        filterRows({
          id: 'filter-chennai',
          label: 'Filter Chennai accounts',
          dataKey: 'accounts',
          predicate: (row: any) => row.city === 'Chennai'
        })
      ],
      edges: [
        { from: 'accounts', to: 'filter-chennai', dataKey: 'accounts' }
      ]
    }

    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.rows).toBeDefined()
  })

  it('pickFields selects specific fields', async () => {
    const graph = {
      id: 'pick-test',
      label: 'Pick Fields Test',
      entryNode: 'accounts',
      nodes: [
        {
          id: 'accounts',
          type: 'query' as ExecutionNodeType,
          label: 'Get accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        },
        pickFields({
          id: 'pick-name-city',
          label: 'Pick name and city',
          dataKey: 'accounts',
          fields: ['name', 'city']
        })
      ],
      edges: [
        { from: 'accounts', to: 'pick-name-city', dataKey: 'accounts' }
      ]
    }

    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.fields).toEqual(['name', 'city'])
  })

  it('sortRows sorts dataset', async () => {
    const graph = {
      id: 'sort-test',
      label: 'Sort Test',
      entryNode: 'accounts',
      nodes: [
        {
          id: 'accounts',
          type: 'query' as ExecutionNodeType,
          label: 'Get accounts',
          plan: {
            needsDb: true,
            entity: 'accounts',
            select: ['accounts.*']
          }
        },
        sortRows({
          id: 'sort-by-name',
          label: 'Sort by name',
          dataKey: 'accounts',
          field: 'name',
          direction: 'asc'
        })
      ],
      edges: [
        { from: 'accounts', to: 'sort-by-name', dataKey: 'accounts' }
      ]
    }

    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.rows).toBeDefined()
  })

  it('aggregateRows performs aggregations', async () => {
    const graph = {
      id: 'aggregate-test',
      label: 'Aggregate Test',
      entryNode: 'opportunities',
      nodes: [
        {
          id: 'opportunities',
          type: 'query' as ExecutionNodeType,
          label: 'Get opportunities',
          plan: {
            needsDb: true,
            entity: 'opportunities',
            select: ['opportunities.*']
          }
        },
        aggregateRows({
          id: 'aggregate-by-account',
          label: 'Aggregate opportunities by account',
          dataKey: 'opportunities',
          groupBy: ['account_id'],
          aggregations: {
            amount: { count: true, sum: true, avg: true },
            account_id: { count: true }
          }
        })
      ],
      edges: [
        { from: 'opportunities', to: 'aggregate-by-account', dataKey: 'opportunities' }
      ]
    }

    const result = await runtime.execute(graph)
    expect(result.success).toBe(true)
    expect(result.finalOutput?.rows).toBeDefined()
  })

})
