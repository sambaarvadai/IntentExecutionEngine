"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaVectorStore = void 0;
const chromadb_1 = require("chromadb");
const COLLECTION_NAME = 'api_definitions';
class ChromaVectorStore {
    constructor(chromaUrl = 'http://localhost:8000') {
        this.collection = null;
        this.client = new chromadb_1.ChromaClient({ path: chromaUrl });
    }
    async init() {
        // Get or create the collection
        this.collection = await this.client.getOrCreateCollection({
            name: COLLECTION_NAME,
            metadata: {
                description: 'API definitions for semantic search',
                'hnsw:space': 'cosine' // use cosine similarity
            }
        });
    }
    ensureInit() {
        if (!this.collection) {
            throw new Error('ChromaVectorStore not initialized. Call init() first.');
        }
        return this.collection;
    }
    async upsert(apiId, embedding, api) {
        const collection = this.ensureInit();
        await collection.upsert({
            ids: [apiId],
            embeddings: [embedding.embedding],
            metadatas: [{
                    apiId,
                    route: api.route,
                    label: api.label,
                    description: api.description ?? '',
                    status: api.status,
                    nodeCount: api.executionGraph?.nodes?.length ?? 0,
                    indexedAt: Date.now()
                }],
            documents: [embedding.text] // original text for inspection
        });
    }
    async search(queryEmbedding, topK = 5) {
        const collection = this.ensureInit();
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
            include: ['metadatas', 'distances', 'documents']
        });
        if (!results.ids[0])
            return [];
        return results.ids[0].map((id, i) => ({
            apiId: id,
            // ChromaDB returns distances — convert to similarity score
            // For cosine: similarity = 1 - distance
            score: 1 - (results.distances?.[0]?.[i] ?? 1),
            metadata: results.metadatas?.[0]?.[i] ?? {}
        }));
    }
    async delete(apiId) {
        const collection = this.ensureInit();
        await collection.delete({ ids: [apiId] });
    }
    async count() {
        const collection = this.ensureInit();
        return collection.count();
    }
}
exports.ChromaVectorStore = ChromaVectorStore;
//# sourceMappingURL=vectorStore.js.map