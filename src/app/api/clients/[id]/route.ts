import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ClientPatch {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  /** ISO YYYY-MM-DD ou null pour effacer. */
  birthday?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  let body: ClientPatch;
  try {
    body = (await request.json()) as ClientPatch;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.first_name !== undefined) patch.first_name = body.first_name?.trim().slice(0, 80) || null;
  if (body.last_name !== undefined) patch.last_name = body.last_name?.trim().slice(0, 80) || null;
  if (body.phone !== undefined) patch.phone = body.phone?.trim().slice(0, 30) || null;
  if (body.email !== undefined) patch.email = body.email?.trim().slice(0, 200) || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim().slice(0, 1000) || null;
  if (body.birthday !== undefined) {
    if (body.birthday === null || body.birthday === "") {
      patch.birthday = null;
    } else if (typeof body.birthday !== "string" || !ISO_DATE.test(body.birthday)) {
      return NextResponse.json(
        { error: "Date d'anniversaire invalide (format YYYY-MM-DD)" },
        { status: 422 }
      );
    } else {
      patch.birthday = body.birthday;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("id, first_name, last_name, phone, email, notes, birthday")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }
  return NextResponse.json({ client: data });
}
