"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APISearchService = void 0;
const types_1 = require("./types");
const api_1 = require("../api");
class APISearchService {
    constructor(embeddings, vectorStore) {
        this.embeddings = embeddings;
        this.vectorStore = vectorStore;
    }
    async init() {
        await this.vectorStore.init();
    }
    // Called when a new ACTIVE API is registered —
    // indexes it so future prompts can find it
    async indexAPI(api) {
        // Embed the text that best describes what this API does
        // Use description + label + generating prompts for richer matching
        const textToEmbed = this.buildIndexText(api);
        const embedding = await this.embeddings.embedDocument(textToEmbed);
        await this.vectorStore.upsert(api.id, embedding, api);
    }
    // Called before LLM generation — check if similar API exists
    async checkCache(prompt) {
        const start = Date.now();
        // Embed the incoming prompt
        const queryEmbedding = await this.embeddings.embed(prompt);
        // Search for similar APIs
        const results = await this.vectorStore.search(queryEmbedding.embedding, 5 // top 5 candidates
        );
        // Filter to hits above threshold
        const hit = results.find(r => r.score >= types_1.SIMILARITY_THRESHOLD);
        if (!hit) {
            return { hit: false, searchTimeMs: Date.now() - start };
        }
        // Load the full API from registry
        const api = await api_1.apiRegistry.get(hit.apiId).catch(() => null);
        // Verify it's still ACTIVE (may have been deprecated since indexing)
        if (!api || api.status !== 'ACTIVE') {
            return { hit: false, searchTimeMs: Date.now() - start };
        }
        return {
            hit: true,
            match: { apiId: hit.apiId, score: hit.score, api },
            searchTimeMs: Date.now() - start
        };
    }
    // Remove from index when API is deprecated or rejected
    async removeFromIndex(apiId) {
        await this.vectorStore.delete(apiId);
    }
    buildIndexText(api) {
        const parts = [
            api.label,
            api.description ?? '',
            ...(api.generatingPrompts ?? [])
        ].filter(Boolean);
        return parts.join('. ');
    }
}
exports.APISearchService = APISearchService;
//# sourceMappingURL=apiSearch.js.map