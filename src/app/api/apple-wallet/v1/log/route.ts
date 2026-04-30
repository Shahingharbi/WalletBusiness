// PassKit Web Service — Apple posts error logs here.
//
// POST /v1/log
//   Body: { "logs": ["...", "..."] }
//   Always reply 200.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { logs?: unknown };
    if (Array.isArray(body.logs)) {
      for (const line of body.logs) {
        console.log("[apple-wallet][apple-log]", line);
      }
    } else {
      console.log("[apple-wallet][apple-log] (non-array body)", body);
    }
  } catch (err) {
    console.warn("[apple-wallet][apple-log] failed to parse body:", err);
  }
  return new NextResponse(null, { status: 200 });
}
