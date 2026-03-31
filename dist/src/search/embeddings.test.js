"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const embeddings_1 = require("./embeddings");
// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;
describe('VoyageEmbeddings', () => {
    let embeddings;
    const mockApiKey = 'test-api-key';
    beforeEach(() => {
        embeddings = new embeddings_1.VoyageEmbeddings(mockApiKey);
        mockFetch.mockClear();
    });
    const mockResponse = (data, ok = true) => {
        return Promise.resolve({
            ok,
            status: ok ? 200 : 400,
            statusText: ok ? 'OK' : 'Bad Request',
            json: () => Promise.resolve(data)
        });
    };
    describe('embed', () => {
        it('embed calls Voyage API with input_type: query', async () => {
            const text = 'test query';
            const mockEmbedding = [0.1, 0.2, 0.3];
            const mockData = {
                data: [{ embedding: mockEmbedding }],
                usage: { total_tokens: 10 }
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embed(text);
            expect(mockFetch).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mockApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: [text],
                    model: 'voyage-3',
                    input_type: 'query'
                })
            });
            expect(result).toEqual({
                text,
                embedding: mockEmbedding,
                model: 'voyage-3',
                tokenCount: 10
            });
        });
        it('throws on non-ok response', async () => {
            const text = 'test query';
            mockFetch.mockReturnValue(mockResponse({}, false));
            await expect(embeddings.embed(text)).rejects.toThrow('Voyage API error: 400 Bad Request');
        });
        it('returns embedding array from response', async () => {
            const text = 'test query';
            const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
            const mockData = {
                data: [{ embedding: mockEmbedding }],
                usage: { total_tokens: 15 }
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embed(text);
            expect(result.embedding).toEqual(mockEmbedding);
            expect(Array.isArray(result.embedding)).toBe(true);
            expect(result.embedding.length).toBe(4);
        });
        it('handles missing usage data', async () => {
            const text = 'test query';
            const mockEmbedding = [0.1, 0.2, 0.3];
            const mockData = {
                data: [{ embedding: mockEmbedding }]
                // no usage field
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embed(text);
            expect(result.tokenCount).toBe(0);
        });
    });
    describe('embedDocument', () => {
        it('embedDocument calls Voyage API with input_type: document', async () => {
            const text = 'test document';
            const mockEmbedding = [0.5, 0.6, 0.7];
            const mockData = {
                data: [{ embedding: mockEmbedding }],
                usage: { total_tokens: 20 }
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embedDocument(text);
            expect(mockFetch).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mockApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: [text],
                    model: 'voyage-3',
                    input_type: 'document'
                })
            });
            expect(result).toEqual({
                text,
                embedding: mockEmbedding,
                model: 'voyage-3',
                tokenCount: 20
            });
        });
        it('throws on non-ok response', async () => {
            const text = 'test document';
            mockFetch.mockReturnValue(mockResponse({}, false));
            await expect(embeddings.embedDocument(text)).rejects.toThrow('Voyage API error: 400 Bad Request');
        });
        it('returns embedding array from response', async () => {
            const text = 'test document';
            const mockEmbedding = [0.8, 0.9, 1.0];
            const mockData = {
                data: [{ embedding: mockEmbedding }],
                usage: { total_tokens: 25 }
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embedDocument(text);
            expect(result.embedding).toEqual(mockEmbedding);
            expect(Array.isArray(result.embedding)).toBe(true);
            expect(result.embedding.length).toBe(3);
        });
        it('handles missing usage data', async () => {
            const text = 'test document';
            const mockEmbedding = [0.8, 0.9, 1.0];
            const mockData = {
                data: [{ embedding: mockEmbedding }]
                // no usage field
            };
            mockFetch.mockReturnValue(mockResponse(mockData));
            const result = await embeddings.embedDocument(text);
            expect(result.tokenCount).toBe(0);
        });
    });
});
//# sourceMappingURL=embeddings.test.js.map