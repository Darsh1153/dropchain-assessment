/**
 * Typed client for the RAG API.
 * On Vercel (and local Next.js dev) calls same-origin /api routes.
 * Set NEXT_PUBLIC_API_BASE_URL to point at a separate backend if needed.
 */

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return "";
  return "http://localhost:3000";
}

export type ProviderMode = "gemini" | "mock";

export interface StoredChunk {
  text: string;
  embedding: number[];
  source: string;
}

export interface IngestResponse {
  ok: true;
  mode: ProviderMode;
  chunksAdded: number;
  totalChunks: number;
  sources: string[];
  storedChunks: StoredChunk[];
}

export interface Citation {
  text: string;
  source: string;
  score: number;
}

export interface QueryResponse {
  ok: true;
  mode: ProviderMode;
  answer: string;
  citations: Citation[];
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function ingestText(text: string, source?: string): Promise<IngestResponse> {
  const res = await fetch(`${apiBase()}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });
  return handle<IngestResponse>(res);
}

export async function ingestFile(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiBase()}/api/ingest`, { method: "POST", body: form });
  return handle<IngestResponse>(res);
}

export async function queryKnowledgeBase(
  question: string,
  storedChunks: StoredChunk[],
  k = 4,
): Promise<QueryResponse> {
  const res = await fetch(`${apiBase()}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, k, storedChunks }),
  });
  return handle<QueryResponse>(res);
}

export async function resetKnowledgeBase(): Promise<void> {
  const res = await fetch(`${apiBase()}/api/reset`, { method: "POST" });
  await handle(res);
}
