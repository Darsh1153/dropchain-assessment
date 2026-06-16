import { randomUUID } from "node:crypto";

export interface StoredChunk {
  id: string;
  text: string;
  embedding: number[];
  source: string;
}

export interface SearchResult {
  id: string;
  text: string;
  source: string;
  score: number;
}

class VectorStore {
  private chunks: StoredChunk[] = [];

  add(entries: { text: string; embedding: number[]; source: string }[]): number {
    for (const entry of entries) {
      this.chunks.push({ id: randomUUID(), ...entry });
    }
    return entries.length;
  }

  search(queryEmbedding: number[], k: number): SearchResult[] {
    return this.chunks
      .map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        source: chunk.source,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  clear(): void {
    this.chunks = [];
  }

  stats(): { chunkCount: number; sources: string[] } {
    const sources = Array.from(new Set(this.chunks.map((c) => c.source)));
    return { chunkCount: this.chunks.length, sources };
  }

  get size(): number {
    return this.chunks.length;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const globalStore = globalThis as typeof globalThis & {
  __dropchainVectorStore?: VectorStore;
};

function getVectorStore(): VectorStore {
  if (!globalStore.__dropchainVectorStore) {
    globalStore.__dropchainVectorStore = new VectorStore();
  }
  return globalStore.__dropchainVectorStore;
}

export const vectorStore = getVectorStore();
