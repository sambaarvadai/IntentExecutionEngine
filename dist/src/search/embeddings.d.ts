import { EmbeddingResult } from './types';
export declare class VoyageEmbeddings {
    private apiKey;
    private model;
    private baseUrl;
    constructor(apiKey: string);
    embed(text: string): Promise<EmbeddingResult>;
    embedDocument(text: string): Promise<EmbeddingResult>;
}
//# sourceMappingURL=embeddings.d.ts.map