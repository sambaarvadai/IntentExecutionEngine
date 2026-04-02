export { APISearchService } from './apiSearch'
export { VoyageEmbeddings } from './embeddings'
export { ChromaVectorStore } from './vectorStore'
export type { 
  EmbeddingResult, 
  SearchResult, 
  SimilarityMatch,
  CacheCheckResult 
} from './types'
export { SIMILARITY_THRESHOLD } from './types'
export { createSearchService } from './factory'
