import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface LocationPatch {
  name?: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number;
  longitude?: number;
  relevant_text?: string | null;
  is_active?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: LocationPatch;
  try {
    body = (await request.json()) as LocationPatch;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Nom invalide" }, { status: 422 });
    }
    patch.name = body.name.trim().slice(0, 120);
  }
  if (body.address !== undefined) patch.address = body.address?.trim().slice(0, 200) || null;
  if (body.city !== undefined) patch.city = body.city?.trim().slice(0, 80) || null;
  if (body.postal_code !== undefined) patch.postal_code = body.postal_code?.trim().slice(0, 20) || null;
  if (body.latitude !== undefined) {
    if (
      typeof body.latitude !== "number" ||
      !Number.isFinite(body.latitude) ||
      body.latitude < -90 ||
      body.latitude > 90
    ) {
      return NextResponse.json({ error: "Latitude invalide" }, { status: 422 });
    }
    patch.latitude = body.latitude;
  }
  if (body.longitude !== undefined) {
    if (
      typeof body.longitude !== "number" ||
      !Number.isFinite(body.longitude) ||
      body.longitude < -180 ||
      body.longitude > 180
    ) {
      return NextResponse.json({ error: "Longitude invalide" }, { status: 422 });
    }
    patch.longitude = body.longitude;
  }
  if (body.relevant_text !== undefined) {
    patch.relevant_text = body.relevant_text?.trim().slice(0, 200) || null;
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const { data, error } = await supabase
    .from("locations")
    .update(patch)
    .eq("id", id)
    .select(
      "id, name, address, city, postal_code, latitude, longitude, relevant_text, is_active, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Localisation introuvable" }, { status: 404 });
  }

  return NextResponse.json({ location: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
