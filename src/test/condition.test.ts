// src/graph/nodes/condition.test.ts

import { ifEmpty, ifRowCountAbove, ifFieldEquals, ifHasRole } from '../graph/nodes/condition'

describe('Condition Node Factories', () => {
  describe('ifEmpty', () => {
    it('returns true when data is empty', () => {
      const node = ifEmpty({
        id: 'check-empty',
        label: 'Check if empty',
        dataKey: 'customers',
        trueBranch: 'log-results',
        falseBranch: 'notify-empty'
      })

      const result = node.condition!({ customers: { rows: [], fields: [] } })
      expect(result).toBe(true)
    })

    it('returns false when data exists', () => {
      const node = ifEmpty({
        id: 'check-not-empty',
        label: 'Check if not empty',
        dataKey: 'customers',
        trueBranch: 'log-results',
        falseBranch: 'notify-empty'
      })

      const result = node.condition!({ customers: { rows: [{ id: 1 }], fields: ['id'] } })
      expect(result).toBe(false)
    })

    it('handles missing dataKey gracefully', () => {
      const node = ifEmpty({
        id: 'check-missing',
        label: 'Check missing dataKey',
        dataKey: 'nonexistent',
        trueBranch: 'log-results',
        falseBranch: 'notify-empty'
      })

      const result = node.condition!({ })
      expect(result).toBe(true) // Should take true branch when no data
    })
  })

  describe('ifRowCountAbove', () => {
    it('returns true when count exceeds threshold', () => {
      const node = ifRowCountAbove({
        id: 'check-count',
        label: 'Check count above threshold',
        dataKey: 'customers',
        threshold: 5,
        trueBranch: 'above-threshold',
        falseBranch: 'below-threshold'
      })

      const result = node.condition!({ 
        customers: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }] }
      })
      expect(result).toBe(true)
    })

    it('returns false when count is below threshold', () => {
      const node = ifRowCountAbove({
        id: 'check-count-low',
        label: 'Check count below threshold',
        dataKey: 'customers',
        threshold: 10,
        trueBranch: 'above-threshold',
        falseBranch: 'below-threshold'
      })

      const result = node.condition!({ 
        customers: { rows: [{ id: 1 }] }
      })
      expect(result).toBe(false)
    })

    it('handles empty dataset correctly', () => {
      const node = ifRowCountAbove({
        id: 'check-empty-count',
        label: 'Check empty count',
        dataKey: 'customers',
        threshold: 0,
        trueBranch: 'has-rows',
        falseBranch: 'no-rows'
      })

      const result = node.condition!({ 
        customers: { rows: [] }
      })
      expect(result).toBe(false)
    })
  })

  describe('ifFieldEquals', () => {
    it('returns true when field matches value', () => {
      const node = ifFieldEquals({
        id: 'check-status',
        label: 'Check status equals active',
        dataKey: 'customers',
        field: 'status',
        value: 'active',
        trueBranch: 'all-active',
        falseBranch: 'not-all-active'
      })

      const result = node.condition!({ 
        customers: { 
          rows: [
            { id: 1, status: 'active', name: 'John' },
            { id: 2, status: 'active', name: 'Jane' },
            { id: 3, status: 'active', name: 'Bob' }
          ]
        }
      })
      expect(result).toBe(true)
    })

    it('returns false when field does not match value', () => {
      const node = ifFieldEquals({
        id: 'check-status-mixed',
        label: 'Check mixed status',
        dataKey: 'customers',
        field: 'status',
        value: 'active',
        trueBranch: 'all-active',
        falseBranch: 'not-all-active'
      })

      const result = node.condition!({ 
        customers: { 
          rows: [
            { id: 1, status: 'active', name: 'John' },
            { id: 2, status: 'inactive', name: 'Jane' },
            { id: 3, status: 'active', name: 'Bob' }
          ]
        }
      })
      expect(result).toBe(false)
    })

    it('handles empty dataset correctly', () => {
      const node = ifFieldEquals({
        id: 'check-empty-status',
        label: 'Check empty status',
        dataKey: 'customers',
        field: 'status',
        value: 'active',
        trueBranch: 'all-active',
        falseBranch: 'not-all-active'
      })

      const result = node.condition!({ 
        customers: { rows: [] }
      })
      expect(result).toBe(false)
    })
  })

  describe('ifHasRole', () => {
    it('returns true when role is present', () => {
      const node = ifHasRole({
        id: 'check-admin-role',
        label: 'Check admin role',
        role: 'admin',
        trueBranch: 'has-admin',
        falseBranch: 'no-admin'
      })

      const result = node.condition!({ 
        _context: { roles: ['user', 'admin'] }
      })
      expect(result).toBe(true)
    })

    it('returns false when role is absent', () => {
      const node = ifHasRole({
        id: 'check-user-role',
        label: 'Check user role',
        role: 'user',
        trueBranch: 'has-user',
        falseBranch: 'no-user'
      })

      const result = node.condition!({ 
        _context: { roles: ['guest'] }
      })
      expect(result).toBe(false)
    })

    it('handles missing context correctly', () => {
      const node = ifHasRole({
        id: 'check-no-context',
        label: 'Check no context',
        role: 'admin',
        trueBranch: 'has-admin',
        falseBranch: 'no-admin'
      })

      const result = node.condition!({ })
      expect(result).toBe(false)
    })
  })
})
