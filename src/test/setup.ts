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
      entity: 'accounts',
      select: ['accounts.*']
    }),
    correctPlan: jest.fn().mockResolvedValue({
      id: 'test-plan-corrected',
      needsDb: true,
      entity: 'accounts',
      select: ['accounts.*', 'contacts.*']
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
      accounts: {
        fields: {
          'accounts.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'accounts.name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'accounts.city': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'accounts.status': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'accounts.*': { type: 'text', filterable: false, selectable: true, sortable: false }
        },
        joins: {
          'contacts': 'accounts.id = contacts.account_id'
        }
      },
      contacts: {
        fields: {
          'contacts.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'contacts.first_name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'contacts.last_name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'contacts.email': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'contacts.account_id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true }
        }
      },
      leads: {
        fields: {
          'leads.id': { type: 'INTEGER', filterable: true, selectable: true, sortable: true },
          'leads.first_name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'leads.last_name': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'leads.email': { type: 'TEXT', filterable: true, selectable: true, sortable: true },
          'leads.status': { type: 'TEXT', filterable: true, selectable: true, sortable: true }
        }
      }
    }
  })
}));
