import { NextResponse } from "next/server";
import { errorMessage, ingestDocument } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const result = await ingestDocument({
        file: file instanceof File ? file : null,
      });
      return NextResponse.json(result);
    }

    const body = await request.json();
    const result = await ingestDocument({
      text: typeof body?.text === "string" ? body.text : undefined,
      source: typeof body?.source === "string" ? body.source : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Ingest error:", err);
    const message = errorMessage(err);
    const status =
      message.includes("No text provided") ||
      message.includes("Only plain .txt") ||
      message.includes("too large") ||
      message.includes("no usable chunks")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
