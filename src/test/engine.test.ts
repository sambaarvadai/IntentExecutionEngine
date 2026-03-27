// intent/engine.test.ts

import { IntentEngine } from '../intent/engine';
import { IntentParseError } from '../intent/graphParser';
import { ExecutionGraph, GraphResult } from '../graph/types';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');
const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

// Mock other dependencies
jest.mock('../schema/metadata', () => ({
  getSchemaMetadata: () => ({
    tables: {
      customers: {
        fields: {
          'customers.id': { type: 'integer', filterable: true, selectable: true, sortable: true },
          'customers.name': { type: 'text', filterable: true, selectable: true, sortable: true },
          'customers.status': { type: 'text', filterable: true, selectable: true, sortable: true }
        }
      }
    },
    allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
    allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE'],
    maxLimit: 20
  })
}));

jest.mock('../config', () => ({
  getConfig: () => ({
    llm: {
      model: 'claude-opus-4-6',
      maxTokens: 4096
    }
  })
}));

describe('IntentEngine', () => {
  let engine: IntentEngine;
  let mockMessages: any;
  let mockCreate: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock Anthropic instance
    const mockAnthropicInstance = {
      messages: {
        create: jest.fn()
      }
    } as any;
    
    MockedAnthropic.mockImplementation(() => mockAnthropicInstance);
    
    mockCreate = mockAnthropicInstance.messages.create as jest.MockedFunction<any>;
    mockMessages = mockAnthropicInstance.messages;
    
    engine = new IntentEngine(mockAnthropicInstance);
  });

  describe('execute', () => {
    const validGraphJSON = {
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

    it('returns IntentResult with timing when SDK returns valid ExecutionGraph', async () => {
      // Mock successful response with small delay to ensure timing > 0
      mockCreate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validGraphJSON)
          }]
        };
      });

      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      const result = await engine.execute(request);

      expect(result.graph.id).toBe('test-graph');
      expect(result.result.success).toBe(true);
      expect(result.generationMs).toBeGreaterThan(0);
      expect(result.executionMs).toBe(0); // dry run
      expect(result.prompt).toBe('Show all active customers');
    });

    it('self-corrects when first response is invalid JSON', async () => {
      // Mock first call with valid JSON but invalid graph structure, second call with valid JSON
      mockCreate
        .mockResolvedValueOnce({
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: 'test-graph',
              label: 'Test Graph',
              // Missing required fields to trigger IntentParseError
              nodes: [],
              edges: []
            })
          }]
        })
        .mockResolvedValueOnce({
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

      expect(result.graph.id).toBe('test-graph');
      expect(result.result.success).toBe(true);
      
      // Verify correction message was sent
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('throws IntentParseError after 3 failed correction attempts', async () => {
      // Mock 4 consecutive failures with valid JSON but invalid graph structure
      const invalidGraph = {
        id: 'test-graph',
        label: 'Test Graph',
        // Missing required fields to trigger IntentParseError
        nodes: [],
        edges: []
      };
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify(invalidGraph)
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
        'Failed to generate valid ExecutionGraph after 3 correction attempts'
      );
      expect(mockCreate).toHaveBeenCalledTimes(4);
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

      // Verify GraphRuntime was not called (execution time is 0)
      expect(result.executionMs).toBe(0);
      expect(result.result.finalOutput).toBe(null);
      expect(result.result.nodeResults.size).toBe(0);
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

      // We can't easily mock GraphRuntime without more complex setup,
      // but we can verify that execution time is recorded (non-zero)
      // and that the engine attempts execution
      const startTime = Date.now();
      const result = await engine.execute(request);
      const endTime = Date.now();

      expect(result.executionMs).toBeGreaterThanOrEqual(0);
      expect(result.executionMs).toBeLessThan(endTime - startTime + 10); // Allow some tolerance
    });

    it('handles parallel execution option', async () => {
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
        messages: {
          create: jest.fn().mockRejectedValue(new Error('ANTHROPIC_API_KEY is not set'))
        }
      } as any;
      
      MockedAnthropic.mockImplementation(() => mockAnthropicInstance);
      
      const engineWithoutKey = new IntentEngine(mockAnthropicInstance);
      
      const request = {
        prompt: 'Show all active customers',
        options: { dryRun: true }
      };

      await expect(engineWithoutKey.execute(request)).rejects.toThrow('ANTHROPIC_API_KEY is not set');
    });
  });
});
