import { chunkText } from "@/lib/server/chunker";
import {
  embed,
  formatProviderError,
  generate,
  providerMode,
  type RetrievedContext,
} from "@/lib/server/provider";
import { vectorStore } from "@/lib/server/vectorStore";

const MAX_FILE_BYTES = 1024 * 1024;

function clampK(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 4;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

function isTextFile(name: string, mimeType: string): boolean {
  const lower = name.toLowerCase();
  return (
    mimeType === "text/plain" ||
    mimeType === "application/octet-stream" ||
    lower.endsWith(".txt")
  );
}

export async function ingestDocument(input: {
  text?: string;
  source?: string;
  file?: File | null;
}) {
  let text = input.text ?? "";
  let source = input.source?.trim() || "pasted-text";

  if (input.file) {
    if (input.file.size > MAX_FILE_BYTES) {
      throw new Error("File is too large. Uploads must be under 1 MB.");
    }

    if (!isTextFile(input.file.name, input.file.type)) {
      throw new Error("Only plain .txt files are supported.");
    }

    text = await input.file.text();
    source = input.file.name || "uploaded-file.txt";
  }

  if (!text.trim()) {
    throw new Error("No text provided. Send { text } or a file.");
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("Text produced no usable chunks.");
  }

  vectorStore.clear();
  const embeddings = await embed(chunks);
  const added = vectorStore.add(
    chunks.map((chunk, i) => ({ text: chunk, embedding: embeddings[i], source })),
  );

  const stats = vectorStore.stats();
  return {
    ok: true as const,
    mode: providerMode,
    chunksAdded: added,
    totalChunks: stats.chunkCount,
    sources: stats.sources,
  };
}

export async function queryDocument(question: string, k = 4) {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("A non-empty 'question' is required.");
  }
  if (vectorStore.size === 0) {
    throw new Error("Knowledge base is empty. Ingest a document first.");
  }

  const [queryEmbedding] = await embed([trimmed]);
  const results = vectorStore.search(queryEmbedding, clampK(k));

  const contexts: RetrievedContext[] = results.map((r) => ({
    text: r.text,
    source: r.source,
    score: r.score,
  }));

  const answer = await generate(trimmed, contexts);

  return {
    ok: true as const,
    mode: providerMode,
    answer,
    citations: results.map((r) => ({
      text: r.text,
      source: r.source,
      score: Number(r.score.toFixed(4)),
    })),
  };
}

export function resetDocumentStore() {
  vectorStore.clear();
  return { ok: true as const, totalChunks: 0 };
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return formatProviderError(err);
  }
  return "Unexpected server error.";
}
