import { NextResponse } from "next/server";
import { resetDocumentStore } from "@/lib/server/rag";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(resetDocumentStore());
}
