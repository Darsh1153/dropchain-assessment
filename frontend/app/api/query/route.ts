import { NextResponse } from "next/server";
import { errorMessage, queryDocument } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question : "";
    const k = body?.k;
    const result = await queryDocument(question, k);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Query error:", err);
    const message = errorMessage(err);
    const status = message.includes("Knowledge base is empty") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
