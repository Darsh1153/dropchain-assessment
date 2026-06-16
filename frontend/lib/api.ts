/**
 * Typed client for the RAG backend. The base URL is injected at build time via
 * NEXT_PUBLIC_API_BASE_URL so the browser can reach the API directly.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:4000";

export type ProviderMode = "gemini" | "mock";

export interface IngestResponse {
  ok: true;
  mode: ProviderMode;
  chunksAdded: number;
  totalChunks: number;
  sources: string[];
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
  const res = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });
  return handle<IngestResponse>(res);
}

export async function ingestFile(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/ingest`, { method: "POST", body: form });
  return handle<IngestResponse>(res);
}

export async function queryKnowledgeBase(question: string, k = 4): Promise<QueryResponse> {
  const res = await fetch(`${BASE_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, k }),
  });
  return handle<QueryResponse>(res);
}

export async function resetKnowledgeBase(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/reset`, { method: "POST" });
  await handle(res);
}
