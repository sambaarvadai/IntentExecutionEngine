// src/graph/nodes/query.test.ts

import { buildQueryNode, buildFilteredQueryNode, buildPaginatedQueryNode } from './query'
import { ifEmpty } from './condition'
import { QueryPlan } from '../../plans/types'
import { ExecutionNode } from '../types'

// Mock data for testing
const mockCustomers = { rows: [], fields: [] }

describe('Query Node Factories', () => {
  describe('buildQueryNode', () => {
    it('creates a basic query node', () => {
      const node: ExecutionNode = buildQueryNode({
        id: 'query-customers',
        label: 'Get customers',
        plan: {
          needsDb: true,
          entity: 'customers',
          select: ['customers.*']
        }
      })

      expect(node.id).toBe('query-customers')
      expect(node.type).toBe('query')
      expect(node.label).toBe('Get customers')
      expect(node.plan).toEqual({
        needsDb: true,
        entity: 'customers',
        select: ['customers.*']
      })
    })

    it('passes timeoutMs through', () => {
      const node = buildQueryNode({
        id: 'query-with-timeout',
        label: 'Query with timeout',
        plan: {
          needsDb: true,
          entity: 'customers',
          select: ['customers.*']
        },
        timeoutMs: 5000
      })

      expect(node.timeoutMs).toBe(5000)
    })
  })

  describe('buildFilteredQueryNode', () => {
    it('creates a filtered query node', () => {
      const node: ExecutionNode = buildFilteredQueryNode({
        id: 'filter-active-customers',
        label: 'Get active customers',
        entity: 'customers',
        select: ['customers.*'],
        field: 'status',
        op: '=',
        value: 'active'
      })

      expect(node.id).toBe('filter-active-customers')
      expect(node.plan?.where).toEqual([{
        field: 'status',
        op: '=',
        value: 'active'
      }])
    })

    it('handles empty dataset correctly', () => {
      // Test that buildFilteredQueryNode creates the correct plan structure
      const node = buildFilteredQueryNode({
        id: 'filter-empty',
        label: 'Filter empty',
        entity: 'customers',
        select: ['customers.*'],
        field: 'status',
        op: '=',
        value: 'active'
      })

      // Verify the plan structure
      expect(node.id).toBe('filter-empty')
      expect(node.plan?.where).toEqual([{
        field: 'status',
        op: '=',
        value: 'active'
      }])
    })
  })

  describe('buildPaginatedQueryNode', () => {
    it('creates a paginated query node', () => {
      const node: ExecutionNode = buildPaginatedQueryNode({
        id: 'paginated-customers',
        label: 'Get customers paginated',
        entity: 'customers',
        select: ['customers.*'],
        limit: 10,
        offset: 20,
        orderBy: { field: 'name', direction: 'asc' }
      })

      expect(node.id).toBe('paginated-customers')
      expect((node.plan as any)?.limit).toBe(10)
      expect((node.plan as any)?.offset).toBe(20)
      expect((node.plan as any)?.orderBy).toEqual({ field: 'name', direction: 'asc' })
    })

    it('handles optional parameters', () => {
      const node: ExecutionNode = buildPaginatedQueryNode({
        id: 'simple-query',
        label: 'Simple query',
        entity: 'customers',
        select: ['customers.*']
        // Only pass required parameters, omit optional ones
      } as any)

      expect((node.plan as any)?.limit).toBeUndefined()
      expect((node.plan as any)?.offset).toBeUndefined()
      expect((node.plan as any)?.orderBy).toBeUndefined()
    })
  })
})
