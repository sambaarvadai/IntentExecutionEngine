"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiSearch_1 = require("./apiSearch");
const embeddings_1 = require("./embeddings");
const vectorStore_1 = require("./vectorStore");
const api_1 = require("../api");
const types_1 = require("./types");
// Mock dependencies
jest.mock('./embeddings');
jest.mock('./vectorStore');
jest.mock('../api');
const MockVoyageEmbeddings = embeddings_1.VoyageEmbeddings;
const MockChromaVectorStore = vectorStore_1.ChromaVectorStore;
const mockApiRegistry = api_1.apiRegistry;
describe('APISearchService', () => {
    let service;
    let mockEmbeddings;
    let mockVectorStore;
    beforeEach(() => {
        mockEmbeddings = {
            embed: jest.fn(),
            embedDocument: jest.fn()
        };
        mockVectorStore = {
            init: jest.fn(),
            search: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
            count: jest.fn()
        };
        service = new apiSearch_1.APISearchService(mockEmbeddings, mockVectorStore);
        // Mock init to resolve immediately
        mockVectorStore.init.mockResolvedValue();
    });
    describe('checkCache', () => {
        const mockPrompt = 'test prompt';
        const mockEmbedding = [0.1, 0.2, 0.3];
        beforeEach(() => {
            mockEmbeddings.embed.mockResolvedValue({
                text: mockPrompt,
                embedding: mockEmbedding,
                model: 'voyage-3',
                tokenCount: 10
            });
        });
        it('returns cache miss when vector store has no results', async () => {
            mockVectorStore.search.mockResolvedValue([]);
            const result = await service.checkCache(mockPrompt);
            expect(result.hit).toBe(false);
            expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.match).toBeUndefined();
        });
        it('returns cache miss when best score is below threshold', async () => {
            const lowScore = types_1.SIMILARITY_THRESHOLD - 0.1;
            mockVectorStore.search.mockResolvedValue([{
                    apiId: 'api-1',
                    score: lowScore,
                    metadata: {}
                }]);
            const result = await service.checkCache(mockPrompt);
            expect(result.hit).toBe(false);
            expect(result.match).toBeUndefined();
        });
        it('returns cache hit when score meets threshold', async () => {
            const highScore = types_1.SIMILARITY_THRESHOLD + 0.05;
            const mockApi = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                description: 'Test description',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockVectorStore.search.mockResolvedValue([{
                    apiId: 'api-1',
                    score: highScore,
                    metadata: {}
                }]);
            mockApiRegistry.get.mockResolvedValue(mockApi);
            const result = await service.checkCache(mockPrompt);
            expect(result.hit).toBe(true);
            expect(result.match).toEqual({
                apiId: 'api-1',
                score: highScore,
                api: mockApi
            });
        });
        it('returns cache miss when matched API is not ACTIVE', async () => {
            const highScore = types_1.SIMILARITY_THRESHOLD + 0.05;
            const inactiveApi = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                description: 'Test description',
                status: 'DEPRECATED',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockVectorStore.search.mockResolvedValue([{
                    apiId: 'api-1',
                    score: highScore,
                    metadata: {}
                }]);
            mockApiRegistry.get.mockResolvedValue(inactiveApi);
            const result = await service.checkCache(mockPrompt);
            expect(result.hit).toBe(false);
            expect(result.match).toBeUndefined();
        });
        it('returns cache miss when API no longer exists in registry', async () => {
            const highScore = types_1.SIMILARITY_THRESHOLD + 0.05;
            mockVectorStore.search.mockResolvedValue([{
                    apiId: 'api-1',
                    score: highScore,
                    metadata: {}
                }]);
            mockApiRegistry.get.mockRejectedValue(new Error('API not found'));
            const result = await service.checkCache(mockPrompt);
            expect(result.hit).toBe(false);
            expect(result.match).toBeUndefined();
        });
    });
    describe('buildIndexText', () => {
        it('combines label, description, generatingPrompts', () => {
            const api = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                description: 'Test description',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                generatingPrompts: ['prompt 1', 'prompt 2']
            };
            // Access private method through type assertion
            const buildIndexText = service.buildIndexText.bind(service);
            const result = buildIndexText(api);
            expect(result).toBe('Test API. Test description. prompt 1. prompt 2');
        });
        it('handles missing description and generatingPrompts', () => {
            const api = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const buildIndexText = service.buildIndexText.bind(service);
            const result = buildIndexText(api);
            expect(result).toBe('Test API');
        });
    });
    describe('indexAPI', () => {
        it('indexAPI calls embedDocument not embed', async () => {
            const api = {
                id: 'api-1',
                route: '/test',
                method: 'GET',
                planId: 'plan-1',
                label: 'Test API',
                description: 'Test description',
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const mockEmbeddingResult = {
                text: 'Test API. Test description',
                embedding: [0.1, 0.2, 0.3],
                model: 'voyage-3',
                tokenCount: 15
            };
            mockEmbeddings.embedDocument.mockResolvedValue(mockEmbeddingResult);
            mockVectorStore.upsert.mockResolvedValue();
            await service.indexAPI(api);
            expect(mockEmbeddings.embedDocument).toHaveBeenCalledWith('Test API. Test description');
            expect(mockEmbeddings.embed).not.toHaveBeenCalled();
            expect(mockVectorStore.upsert).toHaveBeenCalledWith('api-1', mockEmbeddingResult, api);
        });
    });
    describe('removeFromIndex', () => {
        it('calls vectorStore.delete', async () => {
            mockVectorStore.delete.mockResolvedValue();
            await service.removeFromIndex('api-1');
            expect(mockVectorStore.delete).toHaveBeenCalledWith('api-1');
        });
    });
});
//# sourceMappingURL=apiSearch.test.js.map