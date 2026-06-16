import { NextResponse } from "next/server";
import { errorMessage, queryDocument } from "@/lib/server/rag";
import type { ChunkRecord } from "@/lib/server/vectorStore";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseClientChunks(raw: unknown): ChunkRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const chunks = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (typeof record.text !== "string" || typeof record.source !== "string") {
        return null;
      }
      if (!Array.isArray(record.embedding) || record.embedding.length === 0) {
        return null;
      }
      if (!record.embedding.every((value) => typeof value === "number")) {
        return null;
      }
      return {
        text: record.text,
        source: record.source,
        embedding: record.embedding,
      };
    })
    .filter((item): item is ChunkRecord => item !== null);

  return chunks.length > 0 ? chunks : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question : "";
    const k = body?.k;
    const clientChunks = parseClientChunks(body?.storedChunks);
    const result = await queryDocument(question, k, clientChunks);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Query error:", err);
    const message = errorMessage(err);
    const status = message.includes("Knowledge base is empty") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
