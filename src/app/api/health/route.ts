import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, service: "pressroom" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
