"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIMILARITY_THRESHOLD = exports.ChromaVectorStore = exports.VoyageEmbeddings = exports.APISearchService = void 0;
exports.createSearchService = createSearchService;
var apiSearch_1 = require("./apiSearch");
Object.defineProperty(exports, "APISearchService", { enumerable: true, get: function () { return apiSearch_1.APISearchService; } });
var embeddings_1 = require("./embeddings");
Object.defineProperty(exports, "VoyageEmbeddings", { enumerable: true, get: function () { return embeddings_1.VoyageEmbeddings; } });
var vectorStore_1 = require("./vectorStore");
Object.defineProperty(exports, "ChromaVectorStore", { enumerable: true, get: function () { return vectorStore_1.ChromaVectorStore; } });
var types_1 = require("./types");
Object.defineProperty(exports, "SIMILARITY_THRESHOLD", { enumerable: true, get: function () { return types_1.SIMILARITY_THRESHOLD; } });
// Factory — call this at app startup
const embeddings_2 = require("./embeddings");
const vectorStore_2 = require("./vectorStore");
const apiSearch_2 = require("./apiSearch");
function createSearchService(voyageApiKey, chromaUrl) {
    const embeddings = new embeddings_2.VoyageEmbeddings(voyageApiKey);
    const vectorStore = new vectorStore_2.ChromaVectorStore(chromaUrl);
    return new apiSearch_2.APISearchService(embeddings, vectorStore);
}
//# sourceMappingURL=index.js.map