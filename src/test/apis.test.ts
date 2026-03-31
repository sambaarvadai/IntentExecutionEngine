import { apiRouter } from '../api/routes/apis';
import { apiRegistry } from '../api/registry';
import { createSearchService } from '../search';
import { APIDefinition } from '../context/types';

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    VOYAGE_API_KEY: 'test-key',
    CHROMA_URL: 'test-url'
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Mock the search service
jest.mock('../search', () => ({
  createSearchService: jest.fn(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    indexAPI: jest.fn().mockResolvedValue(undefined) as jest.Mock,
    removeFromIndex: jest.fn().mockResolvedValue(undefined) as jest.Mock
  }))
}));

const mockCreateSearchService = createSearchService as jest.MockedFunction<typeof createSearchService>;
// Get the first call (module initialization) which is what the module actually uses
const mockSearchService = mockCreateSearchService.mock.results[0].value as any;

// Mock the registry
jest.mock('../registry', () => ({
  apiRegistry: {
    updateStatus: jest.fn(),
    get: jest.fn()
  }
}));

const mockApiRegistry = apiRegistry as jest.Mocked<typeof apiRegistry>;

describe('API Routes', () => {
  let mockRes: any;
  let mockReq: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock response object
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    
    // Mock request object
    mockReq = {
      params: {},
      body: {},
      query: {}
    };
  });

  describe('PATCH /apis/:id/status', () => {
    it('indexes API in ChromaDB when status changes to ACTIVE', async () => {
      const mockApi: APIDefinition = {
        id: 'api-123',
        route: '/test',
        method: 'GET' as 'GET' | 'POST' | 'PUT' | 'DELETE',
        planId: 'plan-123',
        label: 'Test API',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'ACTIVE' };
      
      mockApiRegistry.updateStatus.mockResolvedValue(mockApi);

      // Find the PATCH /apis/:id/status route handler
      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      expect(routeHandler).toBeDefined();

      // Execute the route handler
      await routeHandler!(mockReq, mockRes);

      // Verify the API status was updated
      expect(mockApiRegistry.updateStatus).toHaveBeenCalledWith('api-123', 'ACTIVE');
      
      // Verify the API was indexed in ChromaDB
      expect(mockSearchService.indexAPI).toHaveBeenCalledWith(mockApi);
      
      // Verify response is 200 regardless of indexing result
      expect(mockRes.status).not.toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(mockApi);
    });

    it('indexes API in ChromaDB when status changes to REVIEW', async () => {
      const mockApi: APIDefinition = {
        id: 'api-123',
        route: '/test',
        method: 'GET',
        planId: 'plan-123',
        label: 'Test API',
        status: 'REVIEW',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'REVIEW' };
      
      mockApiRegistry.updateStatus.mockResolvedValue(mockApi);

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      // Verify the API was indexed in ChromaDB
      expect(mockSearchService.indexAPI).toHaveBeenCalledWith(mockApi);
    });

    it('removes API from ChromaDB when status changes to DEPRECATED', async () => {
      const mockApi: APIDefinition = {
        id: 'api-123',
        route: '/test',
        method: 'GET',
        planId: 'plan-123',
        label: 'Test API',
        status: 'DEPRECATED',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'DEPRECATED' };
      
      mockApiRegistry.updateStatus.mockResolvedValue(mockApi);

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      // Verify the API was removed from ChromaDB
      expect(mockSearchService.removeFromIndex).toHaveBeenCalledWith('api-123');
      
      // Verify the API was NOT indexed
      expect(mockSearchService.indexAPI).not.toHaveBeenCalled();
    });

    it('does not index API when status changes to DRAFT', async () => {
      const mockApi: APIDefinition = {
        id: 'api-123',
        route: '/test',
        method: 'GET',
        planId: 'plan-123',
        label: 'Test API',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'DRAFT' };
      
      mockApiRegistry.updateStatus.mockResolvedValue(mockApi);

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      // Verify the API was NOT indexed or removed
      expect(mockSearchService.indexAPI).not.toHaveBeenCalled();
      expect(mockSearchService.removeFromIndex).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid status', async () => {
      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'INVALID_STATUS' };

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: GENERATED, DRAFT, REVIEW, ACTIVE, DEPRECATED'
      });
    });

    it('returns 404 when API not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { status: 'ACTIVE' };
      
      const error = new Error('API with id nonexistent not found');
      mockApiRegistry.updateStatus.mockRejectedValue(error);

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'API not found' });
    });

    it('handles indexing errors gracefully', async () => {
      const mockApi: APIDefinition = {
        id: 'api-123',
        route: '/test',
        method: 'GET',
        planId: 'plan-123',
        label: 'Test API',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockReq.params = { id: 'api-123' };
      mockReq.body = { status: 'ACTIVE' };
      
      mockApiRegistry.updateStatus.mockResolvedValue(mockApi);
      mockSearchService.indexAPI.mockRejectedValue(new Error('ChromaDB connection failed'));

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const routeHandler = apiRouter.routes.get('PATCH:/apis/:id/status')?.handler;
      await routeHandler!(mockReq, mockRes);

      // Verify error was logged but response still succeeded
      expect(consoleSpy).toHaveBeenCalledWith('Failed to index API in ChromaDB:', expect.any(Error));
      expect(mockRes.json).toHaveBeenCalledWith(mockApi);
      
      consoleSpy.mockRestore();
    });
  });
});
