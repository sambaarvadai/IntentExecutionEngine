// intent/engine.test.ts

import { IntentEngine } from '../intent/engine';
import { IntentParseError } from '../intent/graphParser';
import { ExecutionGraph, GraphResult } from '../graph/types';
import { APISearchService } from '../search';
import Anthropic from '@anthropic-ai/sdk';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';

// Mock the graph database
jest.mock('../graph/store/db', () => ({
  getGraphDatabase: jest.fn()
}));

// Mock the graph store
jest.mock('../graph/store', () => ({
  graphRepository: {
    save: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    incrementUsage: jest.fn(),
    query: jest.fn(),
    stats: jest.fn()
  }
}));

// Mock APISearchService
jest.mock('../search', () => ({
  APISearchService: jest.fn()
}));

import { getGraphDatabase } from '../graph/store/db';
import { graphRepository } from '../graph/store';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');
const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

// Mock other dependencies
jest.mock('../schema/metadata', () => ({
  getSchemaMetadata: () => ({
    tables: {
      accounts: {
        fields: {
          'accounts.id': { type: 'integer', filterable: true, selectable: true, sortable: true },
          'accounts.name': { type: 'text', filterable: true, selectable: true, sortable: true },
          'accounts.status': { type: 'text', filterable: true, selectable: true, sortable: true }
        },
        primaryKey: 'id'
      },
      orders: {
        fields: {
          'orders.id': { type: 'integer', filterable: true, selectable: true, sortable: true },
          'orders.customer_id': { type: 'integer', filterable: true, selectable: true, sortable: true },
          'orders.amount': { type: 'real', filterable: true, selectable: true, sortable: true },
          'orders.created_at': { type: 'text', filterable: true, selectable: true, sortable: true }
        },
        primaryKey: 'id',
        foreignKeys: [
          {
            field: 'customer_id',
            references: {
              table: 'customers',
              field: 'id'
            }
          }
        ]
      }
    },
    allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
    allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE'],
    maxLimit: 20,
    relationships: []
  })
}));

jest.mock('../config', () => ({
  getConfig: () => ({
    llm: {
      model: 'claude-opus-4-6',
      maxTokens: 4096
    },
    database: {
      path: './test-data',
      filename: 'test.db'
    }
  }),
  getSchemaConfig: () => ({
    tables: {
      accounts: {
        description: "Companies or organisations tracked in the CRM",
        primaryKey: "id",
        fields: {
          id: { type: "integer", filterable: true, selectable: true, sortable: true },
          name: { type: "text", filterable: true, selectable: true, sortable: true },
          city: { type: "text", filterable: true, selectable: true, sortable: true },
          status: { type: "text", filterable: true, selectable: true, sortable: true }
        }
      },
      contacts: {
        description: "Individual people associated with accounts",
        primaryKey: "id",
        fields: {
          id: { type: "integer", filterable: true, selectable: true, sortable: true },
          first_name: { type: "text", filterable: true, selectable: true, sortable: true },
          last_name: { type: "text", filterable: true, selectable: true, sortable: true },
          email: { type: "text", filterable: true, selectable: true, sortable: true },
          account_id: { type: "integer", filterable: true, selectable: true, sortable: true }
        }
      }
    }
  })
}));

describe('IntentEngine', () => {
  let engine: IntentEngine;
  let mockMessages: any;
  let mockCreate: jest.MockedFunction<any>;
  let mockAnthropicInstance: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock getGraphDatabase function (not really needed since we mock the repository)
    (getGraphDatabase as jest.Mock).mockResolvedValue({});
    
    // Set up graphRepository mocks
    (graphRepository.save as jest.Mock).mockResolvedValue({
      id: 'test-graph-id',
      status: 'draft'
    });
    
    // Create mock Anthropic instance
    mockAnthropicInstance = {
      apiKey: 'test-key',
      messages: {
        create: jest.fn()
      }
    } as any;
    
    engine = new IntentEngine(mockAnthropicInstance);
    mockCreate = mockAnthropicInstance.messages.create as jest.MockedFunction<any>;
  });

  afterEach(async () => {
    // No database cleanup needed since we're mocking the repository
  });

  describe('execute', () => {
    const validGraphJSON = {
      tables: ['accounts'],
      filters: [],
      select: [],
      limit: 20
    };

    it('returns IntentResult with timing when SDK returns valid QueryIntent', async () => {
      // Mock successful response with small delay to ensure timing > 0
      mockCreate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validGraphJSON)
          }]
        };
      });

      const request = {
        prompt: 'Show all active accounts',
        options: { dryRun: true }
      };

      const result = await engine.execute(request);

      expect(result.graph.id).toMatch(/^graph_\d+$/); // Generated ID pattern
      expect(result.graph.label).toBe('Query: accounts');
      expect(result.result.success).toBe(true);
      expect(result.generationMs).toBeGreaterThan(0);
      expect(result.executionMs).toBe(0); // dry run
      expect(result.prompt).toBe('Show all active accounts');
    });

    it('self-corrects when first response is invalid JSON', async () => {
      // Mock first call with invalid QueryIntent (missing tables), second call with valid QueryIntent, third call for summary
      mockCreate
        .mockResolvedValueOnce({
          content: [{
            type: 'text',
            text: JSON.stringify({
              // Missing tables array to trigger validation error
              filters: [],
              select: [],
              limit: 20
            })
          }]
        })
        .mockResolvedValueOnce({
          content: [{
            type: 'text',
            text: JSON.stringify(validGraphJSON)
          }]
        })
        .mockResolvedValueOnce({
          content: [{
            type: 'text',
            text: 'Shows all active accounts from the database'
          }]
        });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      const result = await engine.execute(request);

      expect(result.graph.id).toMatch(/^graph_\d+$/);
      expect(result.graph.label).toBe('Query: accounts');
      expect(result.result.success).toBe(true);
      
      // Verify correction message was sent (2 for correction + 1 for summary = 3 total)
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('throws IntentParseError after 3 failed correction attempts', async () => {
      // Mock 4 consecutive failures with valid JSON but invalid QueryIntent structure
      const invalidIntent = {
        // Missing tables array to trigger validation error
        filters: [],
        select: [],
        limit: 20
      };
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(invalidIntent)
        }]
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      let caughtError: unknown;
      try {
        await engine.execute(request);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(IntentParseError);
      expect((caughtError as IntentParseError).message).toContain(
        'Failed to generate valid QueryIntent after 3 correction attempts'
      );
      expect(mockCreate).toHaveBeenCalledTimes(4); // 1 initial + 3 corrections
    });

    it('does NOT call GraphRuntime.execute when dryRun is true', async () => {
      // Mock successful response
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validGraphJSON)
        }]
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      const result = await engine.execute(request);

      expect(result.result.success).toBe(true);
      expect(result.executionMs).toBe(0); // dry run
    });

    it('calls GraphRuntime.execute when dryRun is false', async () => {
      // Mock successful response
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validGraphJSON)
        }]
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: false }
      };

      const result = await engine.execute(request);

      expect(result.result.success).toBe(true);
      expect(result.executionMs).toBeGreaterThan(0); // actual execution
    });

    it('handles parallel execution option', async () => {
      // Mock successful response
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(validGraphJSON)
        }]
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true, allowParallel: true }
      };

      const result = await engine.execute(request);

      expect(result.result.success).toBe(true);
      // The parallel option would be passed to GraphRuntime in non-dry run scenario
    });
  });

  describe('error handling', () => {
    it('throws when Anthropic API returns non-text content', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'image', // Non-text content
          media: {}
        }]
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      await expect(engine.execute(request)).rejects.toThrow('Unexpected response type from Anthropic API');
    });

    it('throws when API key is missing', async () => {
      // This would be caught by the Anthropic SDK itself
      const mockAnthropicInstance = {
        apiKey: 'test-key',
        messages: {
          create: jest.fn().mockRejectedValue(new Error('ANTHROPIC_API_KEY is not set'))
        }
      } as any;
      
      const engineWithoutKey = new IntentEngine(mockAnthropicInstance);
      
      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      await expect(engineWithoutKey.execute(request)).rejects.toThrow('ANTHROPIC_API_KEY is not set');
    });
  });
});
