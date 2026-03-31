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

// Factory — call this at app startup
import { VoyageEmbeddings } from './embeddings'
import { ChromaVectorStore } from './vectorStore'
import { APISearchService } from './apiSearch'

export function createSearchService(
  voyageApiKey: string,
  chromaUrl?: string
): APISearchService {
  const embeddings = new VoyageEmbeddings(voyageApiKey);
  const vectorStore = new ChromaVectorStore(chromaUrl);
  return new APISearchService(embeddings, vectorStore);
}
