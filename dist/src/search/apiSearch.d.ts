import { VoyageEmbeddings } from './embeddings';
import { ChromaVectorStore } from './vectorStore';
import { CacheCheckResult } from './types';
import { APIDefinition } from '../context/types';
export declare class APISearchService {
    private embeddings;
    private vectorStore;
    constructor(embeddings: VoyageEmbeddings, vectorStore: ChromaVectorStore);
    init(): Promise<void>;
    indexAPI(api: APIDefinition): Promise<void>;
    checkCache(prompt: string): Promise<CacheCheckResult>;
    removeFromIndex(apiId: string): Promise<void>;
    private buildIndexText;
}
//# sourceMappingURL=apiSearch.d.ts.map