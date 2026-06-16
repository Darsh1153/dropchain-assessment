import { GoogleGenAI } from "@google/genai";

export type ProviderMode = "gemini" | "mock";

export interface RetrievedContext {
  text: string;
  source: string;
  score: number;
}

const apiKey = process.env.GEMINI_API_KEY?.trim();

const chatModel = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.0-flash";

const embedModel =
  process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001";

const EMBED_BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;

export const providerMode: ProviderMode = apiKey ? "gemini" : "mock";

const gemini = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 120_000,
        retryOptions: { attempts: 3 },
      },
    })
  : null;

const SYSTEM_PROMPT =
  "You are a careful assistant for an internal operations tool. " +
  "Answer the user's question using ONLY the provided context. " +
  "If the answer is not contained in the context, reply that you cannot find it in the provided document. " +
  "Do not use outside knowledge. " +
  "Be concise and cite information faithfully.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  const base = Math.min(30_000, 1_000 * 2 ** attempt);
  return base + Math.floor(Math.random() * 500);
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    const status = (error as { status?: number })?.status;
    return status === 429 || status === 500 || status === 502 || status === 503;
  }

  if (error.message.includes("fetch failed")) {
    return true;
  }

  const status = (error as { status?: number }).status;
  return status === 429 || status === 500 || status === 502 || status === 503;
}

export function formatProviderError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unexpected AI provider error.";
  }

  if (error.message.includes("fetch failed")) {
    return "Could not reach the Gemini API. Check your network connection and try again.";
  }

  const status = (error as { status?: number }).status;
  if (status === 503) {
    return "Gemini is temporarily unavailable due to high demand. Please try again in a moment.";
  }
  if (status === 429) {
    return "Gemini rate limit reached. Please wait a moment and try again.";
  }

  return error.message;
}

async function withRetries<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`${label} attempt ${attempt} failed`, error);

      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) {
        break;
      }

      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError;
}

function assertEmbeddings(texts: string[], embeddings: number[][]): void {
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}.`,
    );
  }

  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i].length === 0) {
      throw new Error(`Embedding ${i + 1} of ${texts.length} came back empty.`);
    }
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (!gemini) {
    return texts.map((text) => mockEmbed(text));
  }

  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE);
    const batchEmbeddings = await withRetries(
      `Embedding batch ${start / EMBED_BATCH_SIZE + 1}`,
      async () => {
        const response = await gemini.models.embedContent({
          model: embedModel,
          contents: batch,
        });

        const values = (response.embeddings ?? []).map((entry) => entry.values ?? []);
        assertEmbeddings(batch, values);
        return values;
      },
    );

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

export async function generate(
  question: string,
  contexts: RetrievedContext[],
): Promise<string> {
  const contextBlock = contexts
    .slice(0, 3)
    .map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.text}`)
    .join("\n\n---\n\n");

  if (!gemini) {
    return mockGenerate(question, contexts);
  }

  return withRetries("Generation", async () => {
    const response = await gemini.models.generateContent({
      model: chatModel,
      contents: `
${SYSTEM_PROMPT}

Context:
${contextBlock}

Question:
${question}

Answer using ONLY the provided context.
`,
    });

    return response.text?.trim() ?? "(No answer generated.)";
  });
}

const MOCK_DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function mockEmbed(text: string): number[] {
  const vec = new Array(MOCK_DIM).fill(0);

  for (const token of tokenize(text)) {
    vec[hashToken(token) % MOCK_DIM] += 1;
  }

  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vec;
  }

  return vec.map((value) => value / norm);
}

function hashToken(token: string): number {
  let hash = 2166136261;

  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash);
}

function mockGenerate(question: string, contexts: RetrievedContext[]): string {
  if (contexts.length === 0) {
    return "I cannot find an answer in the provided document because no relevant context was retrieved.";
  }

  const questionTokens = new Set(tokenize(question));

  const sentences = contexts
    .flatMap((c) => c.text.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);

  const ranked = sentences
    .map((sentence) => {
      const overlap = tokenize(sentence).filter((token) => questionTokens.has(token)).length;
      return { sentence, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((item) => item.sentence);

  const body =
    ranked.length > 0 ? ranked.join(" ") : contexts[0].text.slice(0, 400);

  return `[Mock mode - no GEMINI_API_KEY set] Based on the retrieved context: ${body}`;
}
