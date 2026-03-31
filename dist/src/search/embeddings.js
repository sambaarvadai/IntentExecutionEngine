"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoyageEmbeddings = void 0;
class VoyageEmbeddings {
    constructor(apiKey) {
        this.model = 'voyage-3';
        this.baseUrl = 'https://api.voyageai.com/v1/embeddings';
        this.apiKey = apiKey;
    }
    async embed(text) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: [text],
                model: this.model,
                input_type: 'query' // 'query' for search, 'document' for indexing
            })
        });
        if (!response.ok) {
            throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            text,
            embedding: data.data[0].embedding,
            model: this.model,
            tokenCount: data.usage?.total_tokens ?? 0
        };
    }
    async embedDocument(text) {
        // Same as embed() but with input_type: 'document' for indexing
        // Voyage distinguishes query vs document embeddings for better retrieval
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: [text],
                model: this.model,
                input_type: 'document'
            })
        });
        if (!response.ok) {
            throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            text,
            embedding: data.data[0].embedding,
            model: this.model,
            tokenCount: data.usage?.total_tokens ?? 0
        };
    }
}
exports.VoyageEmbeddings = VoyageEmbeddings;
//# sourceMappingURL=embeddings.js.map