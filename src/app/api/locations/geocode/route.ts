import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Proxy Nominatim (OpenStreetMap). Free, no auth, mais le User-Agent est
 * obligatoire et l'usage est rate-limité côté Nominatim (~1 req/sec).
 *
 * On rate-limite aussi côté serveur pour ne pas se faire bannir.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    key: "geocode",
  });
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: "Adresse trop courte (3 caractères min)" },
      { status: 422 }
    );
  }

  // Pas de restriction `countrycodes` : on supporte les commerces hors FR
  // (Algérie, Maroc, Belgique, Suisse, etc.). Le merchant qui tape "Paris"
  // sans pays tombe quand même bien sur Paris (FR) car Nominatim ranke
  // les villes majeures en premier.
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "5",
    "accept-language": "fr",
  });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        signal: ctrl.signal,
        headers: {
          // Nominatim exige un User-Agent identifiant.
          "User-Agent": "aswallet/1.0 (https://aswallet.fr)",
        },
      }
    );
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Service de géocodage indisponible" },
        { status: 502 }
      );
    }
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      class?: string;
    }>;
    const results = data.map((r) => ({
      latitude: Number.parseFloat(r.lat),
      longitude: Number.parseFloat(r.lon),
      display_name: r.display_name,
    }));
    return NextResponse.json({ results });
  } catch (err) {
    console.warn("[geocode] failed:", err);
    return NextResponse.json(
      { error: "Erreur lors du géocodage" },
      { status: 502 }
    );
  }
}
