// PassKit Web Service — return latest .pkpass for a serial.
//
// GET /v1/passes/{passTypeId}/{serialNumber}
//   Headers:
//     Authorization: ApplePass <authenticationToken>
//     If-Modified-Since: <RFC1123 date>     (optionnel)
//   200 + .pkpass body / 304 not-modified / 401 bad auth / 404 unknown

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  generateApplePassBuffer,
  getApplePassTypeId,
  isAppleWalletConfigured,
  verifyApplePassAuthHeader,
} from "@/lib/apple-wallet";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{
    passTypeId: string;
    serialNumber: string;
  }>;
}

export async function GET(request: Request, ctx: RouteCtx) {
  if (!isAppleWalletConfigured()) {
    return new NextResponse(null, { status: 503 });
  }

  const { passTypeId, serialNumber } = await ctx.params;
  const expected = getApplePassTypeId();
  if (!expected || passTypeId !== expected) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = request.headers.get("authorization");
  if (!verifyApplePassAuthHeader(auth, serialNumber)) {
    return new NextResponse(null, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: instance, error } = await admin
    .from("card_instances")
    .select(
      `
        id, token, stamps_collected, rewards_available, status, updated_at,
        clients(first_name),
        cards(id, name, stamp_count, reward_text, design, businesses(name, logo_url))
      `
    )
    .eq("token", serialNumber)
    .single();

  if (error || !instance) {
    return new NextResponse(null, { status: 404 });
  }
  if (instance.status !== "active") {
    return new NextResponse(null, { status: 410 });
  }

  // Conditional GET (If-Modified-Since)
  const ifModifiedSince = request.headers.get("if-modified-since");
  const updatedAt = new Date(instance.updated_at as string);
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince);
    if (!Number.isNaN(since.getTime())) {
      // Comparaison à la seconde (HTTP-date n'a pas les ms).
      const updatedSec = Math.floor(updatedAt.getTime() / 1000);
      const sinceSec = Math.floor(since.getTime() / 1000);
      if (updatedSec <= sinceSec) {
        return new NextResponse(null, { status: 304 });
      }
    }
  }

  const card = instance.cards as unknown as {
    id: string;
    name: string;
    stamp_count: number;
    reward_text: string;
    design: Record<string, unknown>;
    businesses: { name: string; logo_url: string | null } | null;
  };
  const client = instance.clients as unknown as {
    first_name: string | null;
  } | null;
  const design = { ...DEFAULT_CARD_DESIGN, ...(card.design ?? {}) };
  const businessName = card.businesses?.name ?? "Commerce";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
  const merchantLogoUrl =
    (design.logo_url as string | null) ?? card.businesses?.logo_url ?? null;

  const buffer = await generateApplePassBuffer({
    cardId: card.id,
    cardName: card.name,
    businessName,
    customerInstanceToken: instance.token,
    customerFirstName: client?.first_name ?? null,
    stampsCollected: instance.stamps_collected,
    stampsTotal: card.stamp_count,
    rewardsAvailable: instance.rewards_available,
    rewardText: card.reward_text,
    backgroundColor:
      (design.background_color as string) ||
      (design.accent_color as string) ||
      "#ffffff",
    accentColor: (design.accent_color as string) || "#10b981",
    appUrl,
    logoUrl: merchantLogoUrl,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": updatedAt.toUTCString(),
      "Cache-Control": "no-store",
    },
  });
}
