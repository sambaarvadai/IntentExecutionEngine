import { EmbeddingResult } from './types'

interface VoyageAPIResponse {
  data: Array<{
    embedding: number[]
  }>
  usage?: {
    total_tokens: number
  }
}

export class VoyageEmbeddings {
  private apiKey: string
  private model = 'voyage-3'
  private baseUrl = 'https://api.voyageai.com/v1/embeddings'

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: [text],
        model: this.model,
        input_type: 'query'   // 'query' for search, 'document' for indexing
      })
    });

    if (!response.ok) {
      throw new Error(
        `Voyage API error: ${response.status} ${response.statusText}` 
      );
    }

    const data = await response.json() as VoyageAPIResponse;
    return {
      text,
      embedding: data.data[0].embedding,
      model: this.model,
      tokenCount: data.usage?.total_tokens ?? 0
    };
  }

  async embedDocument(text: string): Promise<EmbeddingResult> {
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
        input_type: 'query'   // Use 'query' for symmetric embeddings
      })
    });

    if (!response.ok) {
      throw new Error(
        `Voyage API error: ${response.status} ${response.statusText}` 
      );
    }

    const data = await response.json() as VoyageAPIResponse;
    return {
      text,
      embedding: data.data[0].embedding,
      model: this.model,
      tokenCount: data.usage?.total_tokens ?? 0
    };
  }
}
