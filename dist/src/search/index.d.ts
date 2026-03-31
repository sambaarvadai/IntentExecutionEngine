export { APISearchService } from './apiSearch';
export { VoyageEmbeddings } from './embeddings';
export { ChromaVectorStore } from './vectorStore';
export type { EmbeddingResult, SearchResult, SimilarityMatch, CacheCheckResult } from './types';
export { SIMILARITY_THRESHOLD } from './types';
import { APISearchService } from './apiSearch';
export declare function createSearchService(voyageApiKey: string, chromaUrl?: string): APISearchService;
//# sourceMappingURL=index.d.ts.map