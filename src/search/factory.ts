import { VoyageEmbeddings } from './embeddings';
import { ChromaVectorStore } from './vectorStore';
import { APISearchService } from './apiSearch';

export function createSearchService(
  voyageApiKey: string,
  chromaUrl?: string
): APISearchService {
  const embeddings = new VoyageEmbeddings(voyageApiKey);
  const vectorStore = new ChromaVectorStore(chromaUrl);
  return new APISearchService(embeddings, vectorStore);
}
