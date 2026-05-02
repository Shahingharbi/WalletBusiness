import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeRfmSegmentFromVisits,
  SEGMENT_ORDER,
  type RfmSegment,
} from "@/lib/rfm";

export const runtime = "nodejs";

interface ClientShape {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  card_instances: Array<{
    id: string;
    stamps_collected: number | null;
    last_scanned_at: string | null;
  }> | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();
  if (!profile?.business_id) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
  }

  const businessId = profile.business_id;

  const [{ data: clientsRaw }, { data: txnsRaw }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, phone, card_instances(id, stamps_collected, last_scanned_at)"
      )
      .eq("business_id", businessId),
    supabase
      .from("transactions")
      .select("type, created_at, card_instance_id")
      .eq("business_id", businessId)
      .eq("type", "stamp_add")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const instanceToClient = new Map<string, string>();
  for (const c of (clientsRaw ?? []) as ClientShape[]) {
    for (const i of c.card_instances ?? []) instanceToClient.set(i.id, c.id);
  }

  const visitsByClient = new Map<
    string,
    Array<{ created_at: string; type: string }>
  >();
  for (const t of txnsRaw ?? []) {
    const cid = instanceToClient.get(t.card_instance_id);
    if (!cid) continue;
    const arr = visitsByClient.get(cid) ?? [];
    arr.push({ created_at: t.created_at, type: t.type });
    visitsByClient.set(cid, arr);
  }

  const groups: Record<RfmSegment, Array<Record<string, unknown>>> = {
    champion: [],
    loyal: [],
    at_risk: [],
    lost: [],
    new: [],
  };

  const now = Date.now();
  for (const c of (clientsRaw ?? []) as ClientShape[]) {
    const visits = visitsByClient.get(c.id) ?? [];
    const rfm = computeRfmSegmentFromVisits(visits, now);
    const totalStamps = (c.card_instances ?? []).reduce(
      (acc, i) => acc + (i.stamps_collected ?? 0),
      0
    );
    const lastScan = (c.card_instances ?? []).reduce<string | null>(
      (acc, i) => {
        if (!i.last_scanned_at) return acc;
        if (!acc) return i.last_scanned_at;
        return new Date(i.last_scanned_at) > new Date(acc) ? i.last_scanned_at : acc;
      },
      null
    );
    groups[rfm.segment].push({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      visits_count: rfm.visits_count,
      last_visit: rfm.last_visit ?? lastScan,
      total_stamps: totalStamps,
    });
  }

  return NextResponse.json({
    segments: SEGMENT_ORDER.reduce<Record<RfmSegment, Array<Record<string, unknown>>>>(
      (acc, k) => {
        acc[k] = groups[k];
        return acc;
      },
      { champion: [], loyal: [], at_risk: [], lost: [], new: [] }
    ),
  });
}
