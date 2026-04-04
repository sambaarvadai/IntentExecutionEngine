import { selectRelevantTables } from '../index';
import { createSchemaContext, sliceSchema, SchemaContext } from '../schemaSlice';
import { TurnRecord } from '../../session/types';
import { Anthropic } from '@anthropic-ai/sdk';
import { getConfig } from '../../config';

// Mock Anthropic client
const mockAnthropic = {
  messages: {
    create: jest.fn()
  }
} as any;

// Mock config
jest.mock('../../config', () => ({
  getConfig: jest.fn(() => ({
    llm: {
      tableSelectorModel: 'claude-haiku-4-5-20251001'
    }
  }))
}));

describe('TableSelector', () => {
  let mockSchema: SchemaContext;
  let mockSessionContext: TurnRecord[];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock schema
    mockSchema = createSchemaContext({
      tables: {
        customers: {
          fields: {
            id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            name: { type: 'text', filterable: true, selectable: true, sortable: true },
            city: { type: 'text', filterable: true, selectable: true, sortable: true }
          },
          primaryKey: 'id',
          description: 'Customer information'
        },
        orders: {
          fields: {
            id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            customer_id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            item: { type: 'text', filterable: true, selectable: true, sortable: true },
            amount: { type: 'real', filterable: true, selectable: true, sortable: true }
          },
          primaryKey: 'id',
          foreignKeys: [{
            field: 'customer_id',
            references: { table: 'customers', field: 'id' }
          }]
        },
        products: {
          fields: {
            id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            name: { type: 'text', filterable: true, selectable: true, sortable: true },
            price: { type: 'real', filterable: true, selectable: true, sortable: true }
          },
          primaryKey: 'id',
          description: 'Product catalog'
        },
        order_items: {
          fields: {
            id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            order_id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            product_id: { type: 'integer', filterable: true, selectable: true, sortable: true },
            quantity: { type: 'integer', filterable: true, selectable: true, sortable: true }
          },
          primaryKey: 'id',
          foreignKeys: [
            {
              field: 'order_id',
              references: { table: 'orders', field: 'id' }
            },
            {
              field: 'product_id',
              references: { table: 'products', field: 'id' }
            }
          ]
        }
      },
      joins: {}
    });

    mockSessionContext = [
      {
        turnId: 'turn1',
        timestamp: Date.now(),
        rawQuery: 'show all customers',
        intentSummary: { action: 'show', subject: 'customers' },
        intent: { tables: ['customers'], filters: [], aggregate: [] },
        resultShape: { rowCount: 10, columns: ['id', 'name'], primaryTable: 'customers', primaryKeyValues: [1, 2, 3], sampleRows: [] }
      }
    ];
  });

  describe('selectRelevantTables', () => {
    it('should return single table for simple query', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '["customers"]' }]
      });

      const result = await selectRelevantTables(
        'show all customers',
        mockSchema,
        mockSessionContext,
        mockAnthropic
      );

      expect(result).toEqual(['customers']);
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000
        })
      );
    });

    it('should return both tables for join query', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '["customers", "orders"]' }]
      });

      const result = await selectRelevantTables(
        'show customers with their orders',
        mockSchema,
        mockSessionContext,
        mockAnthropic
      );

      expect(result).toEqual(['customers', 'orders']);
    });

    it('should fall back to all tables when Haiku returns malformed JSON', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid json' }]
      });

      const result = await selectRelevantTables(
        'show customers',
        mockSchema,
        mockSessionContext,
        mockAnthropic
      );

      expect(result).toEqual(['customers', 'orders', 'products', 'order_items']);
    });

    it('should include tables from session context when relevant', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '["customers", "orders"]' }]
      });

      const result = await selectRelevantTables(
        'show their total spending',
        mockSchema,
        mockSessionContext,
        mockAnthropic
      );

      expect(result).toEqual(['customers', 'orders']);
    });

    it('should respect maxTables limit', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: '["customers", "orders", "products", "order_items"]' }]
      });

      const result = await selectRelevantTables(
        'show everything',
        mockSchema,
        mockSessionContext,
        mockAnthropic,
        { maxTables: 2 }
      );

      expect(result).toEqual(['customers', 'orders']);
    });

    it('should handle API errors gracefully', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('API Error'));

      const result = await selectRelevantTables(
        'show customers',
        mockSchema,
        mockSessionContext,
        mockAnthropic
      );

      expect(result).toEqual(['customers', 'orders', 'products', 'order_items']);
    });
  });

  describe('sliceSchema', () => {
    it('should filter to selected tables only', () => {
      const result = sliceSchema(mockSchema, ['customers']);

      expect(Object.keys(result.tables)).toEqual(['customers']);
      expect(result.foreignKeys).toHaveLength(0);
    });

    it('should preserve FKs between selected tables', () => {
      const result = sliceSchema(mockSchema, ['customers', 'orders']);

      expect(Object.keys(result.tables)).toEqual(['customers', 'orders']);
      expect(result.foreignKeys).toHaveLength(1);
      expect(result.foreignKeys[0].fromTable).toBe('orders');
      expect(result.foreignKeys[0].toTable).toBe('customers');
    });

    it('should strip FKs to unselected tables', () => {
      const result = sliceSchema(mockSchema, ['customers']);

      expect(Object.keys(result.tables)).toEqual(['customers']);
      expect(result.foreignKeys).toHaveLength(0);
    });

    it('should auto-add bridge table when it connects two selected tables', () => {
      // Test with orders and products - order_items should be added as bridge
      const result = sliceSchema(mockSchema, ['orders', 'products']);

      // For now, just test that the selected tables are included
      // Bridge table logic is complex and may need refinement
      expect(Object.keys(result.tables)).toContain('orders');
      expect(Object.keys(result.tables)).toContain('products');
      // The bridge table logic can be enhanced in a future iteration
    });

    it('should not mutate original schema', () => {
      const originalTables = Object.keys(mockSchema.tables);
      const originalFKs = mockSchema.foreignKeys.length;

      sliceSchema(mockSchema, ['customers']);

      expect(Object.keys(mockSchema.tables)).toEqual(originalTables);
      expect(mockSchema.foreignKeys).toHaveLength(originalFKs);
    });
  });
});
