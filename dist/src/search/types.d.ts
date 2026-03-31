import { APIDefinition } from '../context/types';
export interface EmbeddingResult {
    text: string;
    embedding: number[];
    model: string;
    tokenCount: number;
}
export interface SimilarityMatch {
    apiId: string;
    score: number;
    api: APIDefinition;
}
export interface SearchResult {
    matches: SimilarityMatch[];
    queryEmbedding: number[];
    searchTimeMs: number;
}
export interface CacheCheckResult {
    hit: boolean;
    match?: SimilarityMatch;
    searchTimeMs: number;
}
export declare const SIMILARITY_THRESHOLD = 0.92;
//# sourceMappingURL=types.d.ts.map