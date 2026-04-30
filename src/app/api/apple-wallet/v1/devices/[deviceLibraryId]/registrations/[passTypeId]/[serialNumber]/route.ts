// PassKit Web Service — Register / Unregister a device for a pass.
//
// POST /v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}
//   Body: { "pushToken": "..." }
//   Headers: Authorization: ApplePass <authenticationToken>
//   201 created / 200 already-registered / 401 bad auth / 404 unknown serial
//
// DELETE /v1/devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}
//   Headers: Authorization: ApplePass <authenticationToken>
//   200 deleted / 401 bad auth

import { NextResponse } from "next/server";
import {
  computeApplePassAuthToken,
  getApplePassTypeId,
  verifyApplePassAuthHeader,
} from "@/lib/apple-wallet";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{
    deviceLibraryId: string;
    passTypeId: string;
    serialNumber: string;
  }>;
}

function ensurePassTypeMatches(passTypeId: string): boolean {
  const expected = getApplePassTypeId();
  return Boolean(expected) && passTypeId === expected;
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { deviceLibraryId, passTypeId, serialNumber } = await ctx.params;

  if (!ensurePassTypeMatches(passTypeId)) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = request.headers.get("authorization");
  if (!verifyApplePassAuthHeader(auth, serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { pushToken?: unknown };
  try {
    body = (await request.json()) as { pushToken?: unknown };
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const pushToken = body.pushToken;
  if (typeof pushToken !== "string" || pushToken.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const admin = createAdminClient();

  // Verifier que le serial correspond à une carte connue.
  const { data: instance, error: instErr } = await admin
    .from("card_instances")
    .select("token")
    .eq("token", serialNumber)
    .maybeSingle();
  if (instErr || !instance) {
    return new NextResponse(null, { status: 404 });
  }

  // Existe déjà ?
  const { data: existing } = await admin
    .from("apple_pass_devices")
    .select("id, push_token")
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_type_id", passTypeId)
    .eq("serial_number", serialNumber)
    .maybeSingle();

  const authToken = computeApplePassAuthToken(serialNumber);

  if (existing) {
    // Mettre à jour le push_token au cas où il aurait changé.
    if (existing.push_token !== pushToken) {
      await admin
        .from("apple_pass_devices")
        .update({ push_token: pushToken, auth_token: authToken })
        .eq("id", existing.id);
    }
    return new NextResponse(null, { status: 200 });
  }

  const { error: insErr } = await admin.from("apple_pass_devices").insert({
    device_library_id: deviceLibraryId,
    pass_type_id: passTypeId,
    serial_number: serialNumber,
    push_token: pushToken,
    auth_token: authToken,
  });
  if (insErr) {
    console.error("[apple-wallet] register insert failed:", insErr);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 201 });
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const { deviceLibraryId, passTypeId, serialNumber } = await ctx.params;

  if (!ensurePassTypeMatches(passTypeId)) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = request.headers.get("authorization");
  if (!verifyApplePassAuthHeader(auth, serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("apple_pass_devices")
    .delete()
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_type_id", passTypeId)
    .eq("serial_number", serialNumber);

  if (error) {
    console.error("[apple-wallet] unregister delete failed:", error);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
