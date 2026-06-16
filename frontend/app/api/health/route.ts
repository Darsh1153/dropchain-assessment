import { NextResponse } from "next/server";
import { providerMode } from "@/lib/server/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", mode: providerMode });
}
