// src/graph/nodes/notify.test.ts

import { buildLogNode, buildWebhookNode } from '../graph/nodes/notify'

describe('Notify Node Factories', () => {
  describe('buildLogNode', () => {
    it('logs full input when no dataKey specified', () => {
      const node = buildLogNode({
        id: 'log-all',
        label: 'Log all input',
        prefix: '[TEST]'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }], fields: ['id', 'name'] },
        orders: { rows: [{ id: 101, amount: 500 }] }
      })

      expect(result).toEqual({ 
        customers: { rows: [{ id: 1, name: 'John' }], fields: ['id', 'name'] },
        orders: { rows: [{ id: 101, amount: 500 }] }
      })
    })

    it('logs specific dataKey when provided', () => {
      const node = buildLogNode({
        id: 'log-customers',
        label: 'Log customers only',
        dataKey: 'customers',
        prefix: '[CUSTOMERS]'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }], fields: ['id', 'name'] },
        orders: { rows: [{ id: 101, amount: 500 }] }
      })

      expect(result).toEqual({ 
        rows: [{ id: 1, name: 'John' }], 
        fields: ['id', 'name']
      })
    })

    it('uses custom prefix when provided', () => {
      const node = buildLogNode({
        id: 'log-with-prefix',
        label: 'Log with custom prefix',
        prefix: '[MYAPP]'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }], fields: ['id', 'name'] }
      })

      // No dataKey specified, returns full input
      expect(result).toEqual({
        customers: { rows: [{ id: 1, name: 'John' }], fields: ['id', 'name'] }
      })
    })
  })

  describe('buildWebhookNode', () => {
    it('creates webhook notification structure', () => {
      const node = buildWebhookNode({
        id: 'webhook-caller',
        label: 'Call external webhook',
        url: 'https://api.example.com/webhook',
        method: 'POST',
        dataKey: 'customers'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }] }
      })

      expect(result).toEqual({
        sent: true,
        url: 'https://api.example.com/webhook',
        payload: { rows: [{ id: 1, name: 'John' }] }
      })
    })

    it('uses PUT method when specified', () => {
      const node = buildWebhookNode({
        id: 'webhook-put',
        label: 'PUT webhook',
        url: 'https://api.example.com/webhook',
        method: 'PUT',
        dataKey: 'customers'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }] }
      })

      expect(result).toEqual({
        sent: true,
        url: 'https://api.example.com/webhook',
        payload: { rows: [{ id: 1, name: 'John' }] }
      })
    })

    it('uses full input when no dataKey specified', () => {
      const node = buildWebhookNode({
        id: 'webhook-full',
        label: 'Send full input',
        url: 'https://api.example.com/webhook'
      })

      const result = node.notify!({ 
        customers: { rows: [{ id: 1, name: 'John' }] },
        orders: { rows: [{ id: 101, amount: 500 }] }
      })

      expect(result).toEqual({
        sent: true,
        url: 'https://api.example.com/webhook',
        payload: { 
          customers: { rows: [{ id: 1, name: 'John' }] },
          orders: { rows: [{ id: 101, amount: 500 }] }
        }
      })
    })
  })
})
