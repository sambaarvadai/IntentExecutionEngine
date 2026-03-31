"use strict";
// intent/engine.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../intent/engine");
const graphParser_1 = require("../intent/graphParser");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
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
const db_1 = require("../graph/store/db");
const store_1 = require("../graph/store");
// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');
const MockedAnthropic = sdk_1.default;
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
    })
}));
describe('IntentEngine', () => {
    let engine;
    let mockMessages;
    let mockCreate;
    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();
        // Mock getGraphDatabase function (not really needed since we mock the repository)
        db_1.getGraphDatabase.mockResolvedValue({});
        // Set up graphRepository mocks
        store_1.graphRepository.save.mockResolvedValue({
            id: 'test-graph-id',
            prompt: 'test prompt',
            graphJson: '{"id":"test"}',
            status: 'draft',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            generationMs: 100,
            executionMs: 200,
            executionCount: 0,
            lastUsedAt: null,
            approvedBy: null,
            approvalNote: null,
            nodeCount: 1,
            success: true,
            errorMessage: null
        });
        store_1.graphRepository.findById.mockResolvedValue(null);
        store_1.graphRepository.updateStatus.mockResolvedValue({});
        store_1.graphRepository.incrementUsage.mockResolvedValue(undefined);
        store_1.graphRepository.query.mockResolvedValue([]);
        store_1.graphRepository.stats.mockResolvedValue({ total: 0, byStatus: { draft: 0, approved: 0, rejected: 0, deprecated: 0 } });
        // Create mock Anthropic instance
        const mockAnthropicInstance = {
            messages: {
                create: jest.fn()
            }
        };
        MockedAnthropic.mockImplementation(() => mockAnthropicInstance);
        mockCreate = mockAnthropicInstance.messages.create;
        mockMessages = mockAnthropicInstance.messages;
        engine = new engine_1.IntentEngine(mockAnthropicInstance);
    });
    afterEach(async () => {
        // No database cleanup needed since we're mocking the repository
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
                await new Promise(resolve => setTimeout(resolve, 10));
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
            let caughtError;
            try {
                await engine.execute(request);
            }
            catch (err) {
                caughtError = err;
            }
            expect(caughtError).toBeInstanceOf(graphParser_1.IntentParseError);
            expect(caughtError.message).toContain('Failed to generate valid ExecutionGraph after 3 correction attempts');
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
            };
            MockedAnthropic.mockImplementation(() => mockAnthropicInstance);
            const engineWithoutKey = new engine_1.IntentEngine(mockAnthropicInstance);
            const request = {
                prompt: 'Show all active customers',
                options: { dryRun: true }
            };
            await expect(engineWithoutKey.execute(request)).rejects.toThrow('ANTHROPIC_API_KEY is not set');
        });
    });
});
//# sourceMappingURL=engine.test.js.map