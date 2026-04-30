// PassKit Web Service — list passes updated since a given tag.
//
// GET /v1/devices/{deviceLibraryId}/registrations/{passTypeId}?passesUpdatedSince={tag}
//   200 -> { lastUpdated: "<tag>", serialNumbers: ["...", "..."] }
//   204 -> rien à updater pour ce device
//
// Le `tag` que l'on renvoie = un timestamp (ms) string. iOS nous le
// renverra tel quel à la prochaine requête. On filtre par
// card_instances.updated_at > tag.

import { NextResponse } from "next/server";
import { getApplePassTypeId } from "@/lib/apple-wallet";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{
    deviceLibraryId: string;
    passTypeId: string;
  }>;
}

export async function GET(request: Request, ctx: RouteCtx) {
  const { deviceLibraryId, passTypeId } = await ctx.params;
  const expected = getApplePassTypeId();
  if (!expected || passTypeId !== expected) {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(request.url);
  const sinceTag = url.searchParams.get("passesUpdatedSince");
  // Le tag est un timestamp ms qu'on a émis précédemment. Si invalide on
  // renvoie tous les serials enregistrés (comme un premier appel).
  const sinceDate = sinceTag ? new Date(Number(sinceTag)) : null;
  const sinceIso =
    sinceDate && !Number.isNaN(sinceDate.getTime())
      ? sinceDate.toISOString()
      : null;

  const admin = createAdminClient();

  // Tous les serials que ce device a enregistrés.
  const { data: registrations, error: regErr } = await admin
    .from("apple_pass_devices")
    .select("serial_number")
    .eq("device_library_id", deviceLibraryId)
    .eq("pass_type_id", passTypeId);

  if (regErr) {
    console.error("[apple-wallet] list registrations failed:", regErr);
    return new NextResponse(null, { status: 500 });
  }
  if (!registrations || registrations.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const serials = registrations.map((r) => r.serial_number);

  // Filtrer par updated_at > sinceIso (si fourni).
  let query = admin
    .from("card_instances")
    .select("token, updated_at")
    .in("token", serials);
  if (sinceIso) {
    query = query.gt("updated_at", sinceIso);
  }
  const { data: instances, error: instErr } = await query;
  if (instErr) {
    console.error("[apple-wallet] query instances failed:", instErr);
    return new NextResponse(null, { status: 500 });
  }

  if (!instances || instances.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  // Le nouveau tag = le max(updated_at) en millisecondes.
  let maxMs = 0;
  for (const i of instances) {
    const t = new Date(i.updated_at as string).getTime();
    if (t > maxMs) maxMs = t;
  }

  return NextResponse.json({
    lastUpdated: String(maxMs),
    serialNumbers: instances.map((i) => i.token),
  });
}
