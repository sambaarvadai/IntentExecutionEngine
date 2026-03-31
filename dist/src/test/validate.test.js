"use strict";
// ------------------------------------------------------------------
// Graph Validation API Tests
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
const graphs_1 = require("../api/routes/graphs");
const intent_1 = require("../intent");
const intent_2 = require("../intent");
// Mock the IntentEngine
jest.mock('../intent/engine');
const MockedIntentEngine = intent_1.IntentEngine;
// Mock the graph repository
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
// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk');
// Simple express-like app for testing
function createTestApp() {
    const routes = new Map();
    // Register all routes from the router
    for (const [key, { handler }] of graphs_1.graphRouter.routes) {
        const [method, path] = key.split(':');
        routes.set(`${method} ${path}`, handler);
    }
    return async (req) => {
        const handler = routes.get(`${req.method} ${req.path}`);
        if (!handler) {
            return { status: 404, body: { error: 'Not found' } };
        }
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        try {
            await handler(req, res);
            return {
                status: res.status.mock.calls[0]?.[0] || 200,
                body: res.json.mock.calls[0]?.[0]
            };
        }
        catch (error) {
            return {
                status: 500,
                body: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
        }
    };
}
describe('POST /graphs/validate', () => {
    let testApp;
    let mockEngine;
    beforeEach(() => {
        jest.clearAllMocks();
        testApp = createTestApp();
        // Create mock engine instance
        mockEngine = {
            execute: jest.fn()
        };
        MockedIntentEngine.mockImplementation(() => mockEngine);
    });
    it('should return validation success for valid prompt', async () => {
        const mockGraph = {
            id: 'test-graph',
            label: 'Test Graph',
            nodes: [
                { id: 'node1', type: 'query', label: 'Query Node' }
            ],
            edges: [],
            entryNode: 'node1'
        };
        const mockGraphResult = {
            graphId: 'test-graph',
            success: true,
            nodeResults: new Map([
                ['node1', { nodeId: 'node1', success: true, executionTime: 25 }]
            ]),
            finalOutput: [],
            totalExecutionTime: 25
        };
        const mockResult = {
            graph: mockGraph,
            result: mockGraphResult,
            generationMs: 150,
            executionMs: 50,
            prompt: 'Show all customers',
            storedGraphId: 'test-graph-id'
        };
        mockEngine.execute.mockResolvedValue(mockResult);
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                prompt: 'Show all customers',
                context: { user: { id: 'test-user' } }
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            graphId: 'test-graph-id',
            graph: mockGraph,
            generationMs: 150,
            valid: true,
            nodeCount: 1
        });
        expect(mockEngine.execute).toHaveBeenCalledWith({
            prompt: 'Show all customers',
            context: { user: { id: 'test-user' } },
            options: { dryRun: true }
        });
    });
    it('should return 422 for IntentParseError', async () => {
        const parseError = new intent_2.IntentParseError('Invalid prompt syntax', { details: 'Expected table name' }, 'invalid prompt text');
        mockEngine.execute.mockRejectedValue(parseError);
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                prompt: 'invalid prompt',
                context: { user: { id: 'test-user' } }
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
            valid: false,
            error: 'Invalid prompt syntax',
            details: { details: 'Expected table name' }
        });
    });
    it('should return 400 for missing prompt', async () => {
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                context: { user: { id: 'test-user' } }
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Prompt is required and must be a string'
        });
    });
    it('should return 400 for non-string prompt', async () => {
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                prompt: 123,
                context: { user: { id: 'test-user' } }
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Prompt is required and must be a string'
        });
    });
    it('should return 500 for other errors', async () => {
        mockEngine.execute.mockRejectedValue(new Error('Database connection failed'));
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                prompt: 'Show all customers',
                context: { user: { id: 'test-user' } }
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: 'Database connection failed'
        });
    });
    it('should work without optional context', async () => {
        const mockGraph = {
            id: 'test-graph-2',
            label: 'Test Graph 2',
            nodes: [
                { id: 'node1', type: 'query', label: 'Query Node' }
            ],
            edges: [],
            entryNode: 'node1'
        };
        const mockGraphResult = {
            graphId: 'test-graph-2',
            success: true,
            nodeResults: new Map([
                ['node1', { nodeId: 'node1', success: true, executionTime: 25 }]
            ]),
            finalOutput: [],
            totalExecutionTime: 25
        };
        const mockResult = {
            graph: mockGraph,
            result: mockGraphResult,
            generationMs: 100,
            executionMs: 25,
            prompt: 'List customers',
            storedGraphId: 'test-graph-id-2'
        };
        mockEngine.execute.mockResolvedValue(mockResult);
        const req = {
            method: 'POST',
            path: '/graphs/validate',
            body: {
                prompt: 'List customers'
            }
        };
        const response = await testApp(req);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            graphId: 'test-graph-id-2',
            graph: mockGraph,
            generationMs: 100,
            valid: true,
            nodeCount: 1
        });
        expect(mockEngine.execute).toHaveBeenCalledWith({
            prompt: 'List customers',
            context: undefined,
            options: { dryRun: true }
        });
    });
});
//# sourceMappingURL=validate.test.js.map