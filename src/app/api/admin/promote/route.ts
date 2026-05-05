import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/admin/promote
 *
 * Body : `{ email: string }`
 *
 * Réservé super_admin : promeut un compte existant au rôle `super_admin`.
 * Le user pourra ensuite voir l'item "Admin" dans la sidebar.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (caller?.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json(
      { error: "Email requis" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Récupère l'id auth.users via listUsers (pas de méthode getByEmail dispo
  // dans @supabase/supabase-js v2 — on filtre côté server).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return NextResponse.json(
      { error: "Échec de la recherche du compte" },
      { status: 500 }
    );
  }
  const target = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === email
  );
  if (!target) {
    return NextResponse.json(
      { error: "Aucun compte trouvé pour cet email" },
      { status: 404 }
    );
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ role: "super_admin" })
    .eq("id", target.id);

  if (updErr) {
    console.error("[admin/promote] update failed:", updErr);
    return NextResponse.json(
      { error: "Échec de la mise à jour du rôle" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, userId: target.id });
}
