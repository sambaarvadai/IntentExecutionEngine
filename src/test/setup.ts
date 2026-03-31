// ------------------------------------------------------------------
// Test Setup
// ------------------------------------------------------------------

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';

// Override debug flag for cleaner test output
process.env.DEBUG = 'false';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock database module
jest.mock('../db/sqlite', () => ({
  getDatabase: jest.fn(() => Promise.resolve({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock LLM module
jest.mock('../plans/anthropicAdapter', () => ({
  AnthropicAdapter: jest.fn().mockImplementation(() => ({
    generatePlan: jest.fn().mockResolvedValue({
      id: 'test-plan',
      needsDb: true,
      entity: 'customers',
      select: ['customers.*']
    }),
    correctPlan: jest.fn().mockResolvedValue({
      id: 'test-plan-corrected',
      needsDb: true,
      entity: 'customers',
      select: ['customers.*', 'orders.*']
    })
  }))
}));

// Mock config module
jest.mock('../config', () => ({
  config: {
    database: {
      path: ':memory:',
      timeout: 10000
    },
    llm: {
      model: 'claude-3-haiku-20240307',
      maxTokens: 1000
    }
  }
}));

// Mock schema metadata module
jest.mock('../schema/metadata', () => ({
  getSchemaMetadata: jest.fn().mockReturnValue({
    tables: {
      customers: {
        fields: {
          'customers.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'customers.name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'customers.city': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'customers.score': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'customers.*': { type: 'text', filterable: false, selectable: true, sortable: false }
        },
        joins: {
          'orders': 'customers.id = orders.customer_id'
        }
      },
      orders: {
        fields: {
          'orders.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'orders.customer_id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'orders.item': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'orders.amount': { type: 'REAL', filterable: true, selectable: true, sortable: true },
          'orders.created_at': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'orders.*': { type: 'text', filterable: false, selectable: true, sortable: false }
        },
        joins: undefined
      }
    },
    allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
    allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN'],
    maxLimit: 100
  })
}));
