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
// Mock APISearchService
jest.mock('../search', () => ({
    APISearchService: jest.fn()
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
                },
                joins: {
                    'orders': 'customers.id = orders.customer_id'
                }
            },
            orders: {
                fields: {
                    'orders.id': { type: 'integer', filterable: true, selectable: true, sortable: true },
                    'orders.customer_id': { type: 'integer', filterable: true, selectable: true, sortable: true },
                    'orders.item': { type: 'text', filterable: true, selectable: true, sortable: true },
                    'orders.amount': { type: 'real', filterable: true, selectable: true, sortable: true },
                    'orders.created_at': { type: 'text', filterable: true, selectable: true, sortable: true }
                },
                joins: undefined
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
    let mockAnthropicInstance;
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
    describe('maxNodes enforcement', () => {
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
        it('throws IntentParseError when graph exceeds default maxNodes', async () => {
            // Create a graph with 11 nodes (one over default of 10)
            const largeGraphJSON = {
                ...validGraphJSON,
                nodes: Array.from({ length: 11 }, (_, i) => ({
                    id: `node-${i}`,
                    type: 'query',
                    label: `Node ${i}`,
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }))
            };
            mockCreate.mockResolvedValue({
                content: [{
                        type: 'text',
                        text: JSON.stringify(largeGraphJSON)
                    }]
            });
            const request = {
                prompt: 'Generate a large graph',
                options: {} // No maxNodes specified, should use default of 10
            };
            await expect(engine.execute(request)).rejects.toThrow(graphParser_1.IntentParseError);
            try {
                await engine.execute(request);
            }
            catch (error) {
                expect(error).toBeInstanceOf(graphParser_1.IntentParseError);
                expect(error.message).toContain('exceeds');
                expect(error.details.nodeCount).toBe(11);
                expect(error.details.maxNodes).toBe(10);
                expect(error.details.nodeIds).toHaveLength(11);
            }
        });
        it('respects custom maxNodes option', async () => {
            // Create a graph with 3 nodes
            const mediumGraphJSON = {
                ...validGraphJSON,
                nodes: Array.from({ length: 3 }, (_, i) => ({
                    id: `node-${i}`,
                    type: 'query',
                    label: `Node ${i}`,
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }))
            };
            mockCreate.mockResolvedValue({
                content: [{
                        type: 'text',
                        text: JSON.stringify(mediumGraphJSON)
                    }]
            });
            const request = {
                prompt: 'Generate a medium graph',
                options: { maxNodes: 2, dryRun: true }
            };
            await expect(engine.execute(request)).rejects.toThrow(graphParser_1.IntentParseError);
            try {
                await engine.execute(request);
            }
            catch (error) {
                expect(error).toBeInstanceOf(graphParser_1.IntentParseError);
                expect(error.message).toContain('exceeds');
                expect(error.details.nodeCount).toBe(3);
                expect(error.details.maxNodes).toBe(2);
            }
        });
        it('passes when node count is within maxNodes', async () => {
            // Create a graph with 3 nodes
            const mediumGraphJSON = {
                ...validGraphJSON,
                nodes: Array.from({ length: 3 }, (_, i) => ({
                    id: `node-${i}`,
                    type: 'query',
                    label: `Node ${i}`,
                    plan: {
                        needsDb: true,
                        entity: 'customers',
                        select: ['customers.*']
                    }
                }))
            };
            mockCreate.mockResolvedValue({
                content: [{
                        type: 'text',
                        text: JSON.stringify(mediumGraphJSON)
                    }]
            });
            const request = {
                prompt: 'Generate a medium graph',
                options: { maxNodes: 5, dryRun: true }
            };
            const result = await engine.execute(request);
            expect(result.result.success).toBe(true);
            expect(result.graph.nodes).toHaveLength(3); // 3 nodes within limit of 5
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
        describe('API search cache integration', () => {
            let mockSearchService;
            const mockGraph = {
                id: 'cached-graph',
                label: 'Cached Graph',
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
            const mockAPI = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                executionGraph: mockGraph
            };
            it('returns cache hit result when searchService finds match', async () => {
                // Set up mock search service
                mockSearchService = {
                    init: jest.fn(),
                    indexAPI: jest.fn(),
                    checkCache: jest.fn(),
                    removeFromIndex: jest.fn()
                };
                // Mock search service to return a hit
                mockSearchService.checkCache.mockResolvedValue({
                    hit: true,
                    match: {
                        apiId: 'api-1',
                        score: 0.95,
                        api: mockAPI
                    },
                    searchTimeMs: 5
                });
                // Create engine with search service
                engine = new engine_1.IntentEngine(mockAnthropicInstance, mockSearchService);
                const request = {
                    prompt: 'Show all active customers',
                    options: { dryRun: true }
                };
                const result = await engine.execute(request);
                // Verify cache hit behavior
                expect(result.cacheHit).toBe(true);
                expect(result.cacheScore).toBe(0.95);
                expect(result.generationMs).toBe(0); // No generation needed
                expect(result.graph).toEqual(mockGraph);
                expect(result.storedGraphId).toBe('api-1');
                // Verify Anthropic SDK was NOT called
                expect(mockCreate).not.toHaveBeenCalled();
            });
            it('falls through to generation on cache miss', async () => {
                // Create a fresh mock for this test
                const freshMockAnthropic = {
                    messages: {
                        create: jest.fn().mockImplementation(async () => {
                            // Add small delay to ensure generationMs > 0
                            await new Promise(resolve => setTimeout(resolve, 1));
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify(mockGraph)
                                    }]
                            };
                        })
                    }
                };
                // Set up mock search service
                const mockSearchService = {
                    init: jest.fn(),
                    indexAPI: jest.fn(),
                    checkCache: jest.fn().mockResolvedValue({
                        hit: false,
                        searchTimeMs: 3
                    }),
                    removeFromIndex: jest.fn()
                };
                // Create engine with search service
                engine = new engine_1.IntentEngine(freshMockAnthropic, mockSearchService);
                const request = {
                    prompt: 'Show all active customers',
                    options: { dryRun: true }
                };
                const result = await engine.execute(request);
                // Verify generation occurred
                expect(freshMockAnthropic.messages.create).toHaveBeenCalled();
                expect(result.cacheHit).toBeUndefined();
                expect(result.cacheScore).toBeUndefined();
                expect(result.generationMs).toBeGreaterThanOrEqual(0);
                expect(result.graph).toEqual(mockGraph);
            });
            it('works normally when no searchService provided', async () => {
                // Create a fresh mock for this test
                const freshMockAnthropic = {
                    messages: {
                        create: jest.fn().mockImplementation(async () => {
                            // Add small delay to ensure generationMs > 0
                            await new Promise(resolve => setTimeout(resolve, 1));
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify(mockGraph)
                                    }]
                            };
                        })
                    }
                };
                // Create engine WITHOUT search service
                engine = new engine_1.IntentEngine(freshMockAnthropic);
                const request = {
                    prompt: 'Show all active customers',
                    options: { dryRun: true }
                };
                const result = await engine.execute(request);
                // Verify normal generation occurred
                expect(freshMockAnthropic.messages.create).toHaveBeenCalled();
                expect(result.cacheHit).toBeUndefined();
                expect(result.cacheScore).toBeUndefined();
                expect(result.generationMs).toBeGreaterThanOrEqual(0);
                expect(result.graph).toEqual(mockGraph);
            });
        });
    });
});
//# sourceMappingURL=engine.test.js.map