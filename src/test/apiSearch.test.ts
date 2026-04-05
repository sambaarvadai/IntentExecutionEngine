import { APISearchService } from '../search/apiSearch';
import { VoyageEmbeddings } from '../search/embeddings';
import { ChromaVectorStore } from '../search/vectorStore';
import { APIDefinition } from '../context/types';
import { apiRegistry } from '../api';
import { SIMILARITY_THRESHOLD } from '../search/types';
import { graphRepository } from '../graph/store';

// Mock dependencies
jest.mock('../search/embeddings');
jest.mock('../search/vectorStore');
jest.mock('../api', () => ({
  apiRegistry: {
    get: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn(),
    list: jest.fn(),
    delete: jest.fn()
  }
}));
jest.mock('../graph/store', () => ({
  GraphRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    count: jest.fn()
  })),
  graphRepository: {
    findById: jest.fn(),
    save: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    count: jest.fn()
  }
}));

const MockVoyageEmbeddings = VoyageEmbeddings as jest.MockedClass<typeof VoyageEmbeddings>;
const MockChromaVectorStore = ChromaVectorStore as jest.MockedClass<typeof ChromaVectorStore>;
const mockApiRegistry = apiRegistry as jest.Mocked<typeof apiRegistry>;

describe('APISearchService', () => {
  let service: APISearchService;
  let mockEmbeddings: jest.Mocked<VoyageEmbeddings>;
  let mockVectorStore: jest.Mocked<ChromaVectorStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbeddings = {
      embed: jest.fn(),
      embedDocument: jest.fn()
    } as any;
    mockVectorStore = {
      init: jest.fn(),
      search: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    } as any;
    service = new APISearchService(mockEmbeddings, mockVectorStore);

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
      const lowScore = SIMILARITY_THRESHOLD - 0.1;
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
      const highScore = SIMILARITY_THRESHOLD + 0.05;
      const mockApi: APIDefinition = {
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
      const highScore = SIMILARITY_THRESHOLD + 0.05;
      const inactiveApi: APIDefinition = {
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
      const highScore = SIMILARITY_THRESHOLD + 0.05;

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
      const api: APIDefinition = {
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
      const buildIndexText = (service as any).buildIndexText.bind(service);
      const result = buildIndexText(api);

      expect(result).toBe('prompt 1. prompt 2');
    });

    it('handles missing description and generatingPrompts', () => {
      const api: APIDefinition = {
        id: 'api-1',
        route: '/test',
        method: 'GET',
        planId: 'plan-1',
        label: 'Test API',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const buildIndexText = (service as any).buildIndexText.bind(service);
      const result = buildIndexText(api);

      expect(result).toBe('Test API');
    });
  });

  describe('indexAPI', () => {
    it('indexAPI calls embedDocument not embed', async () => {
      const api: APIDefinition = {
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

      expect(mockEmbeddings.embedDocument).toHaveBeenCalledWith('Test API');
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
