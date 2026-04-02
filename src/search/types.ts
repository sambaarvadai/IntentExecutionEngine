import { APIDefinition } from '../context/types'

export interface EmbeddingResult {
  text: string
  embedding: number[]
  model: string
  tokenCount: number
}

export interface SimilarityMatch {
  apiId: string
  score: number          // cosine similarity 0-1
  api: APIDefinition     // the matched API
}

export interface SearchResult {
  matches: SimilarityMatch[]
  queryEmbedding: number[]
  searchTimeMs: number
}

export interface CacheCheckResult {
  hit: boolean
  match?: SimilarityMatch
  searchTimeMs: number
}

export const SIMILARITY_THRESHOLD = 0.90  // tune this - restored for high precision
