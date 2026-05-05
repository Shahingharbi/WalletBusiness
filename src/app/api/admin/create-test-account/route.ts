import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Génère un mot de passe aléatoire 16 chars URL-safe (alphanum + quelques
 * symboles compatibles avec la policy Supabase).
 */
function genPassword(): string {
  const alphabet =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * POST /api/admin/create-test-account
 *
 * Réservé aux super_admin. Crée un compte business_owner avec abonnement
 * Business actif jusqu'en 2126 (pratique pour démo merchant). Le client (la
 * page /admin) reçoit `{ email, password }` à copier — l'admin peut transmettre
 * les identifiants par DM/téléphone au merchant.
 */
export async function POST(request: Request) {
  // 1. Vérifie que l'appelant est super_admin (server-side, pas du client).
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 2. Parse + valide le body.
  let body: {
    email?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    business_name?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstName =
    typeof body.first_name === "string" ? body.first_name.trim() : "";
  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : "";
  const businessName =
    typeof body.business_name === "string" ? body.business_name.trim() : "";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Adresse email invalide" },
      { status: 422 }
    );
  }
  if (!firstName || !lastName || !businessName) {
    return NextResponse.json(
      { error: "Tous les champs sont requis" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();
  const password = genPassword();

  // 3. Crée le user via Supabase Auth Admin (auto-confirm email pour un test).
  //    Le trigger `handle_new_user` se charge en parallèle de créer la row
  //    `profiles` + `businesses` à partir des metadata.
  const { data: createdUser, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "business_owner",
        business_name: businessName,
        first_name: firstName,
        last_name: lastName,
      },
    });
  if (createErr || !createdUser?.user) {
    console.error("[admin/create-test-account] createUser failed:", createErr);
    return NextResponse.json(
      {
        error:
          createErr?.message ?? "Création du compte impossible (email déjà utilisé ?)",
      },
      { status: 400 }
    );
  }

  const newUserId = createdUser.user.id;

  // 4. Le trigger handle_new_user devrait avoir créé la row businesses. On
  //    récupère son id pour la patcher en plan "Business" actif quasi éternel.
  //    Si jamais le trigger n'a pas encore fini (race), on attend une petite
  //    poll de 200ms x 5.
  let businessId: string | null = null;
  for (let i = 0; i < 5; i++) {
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", newUserId)
      .maybeSingle();
    if (biz) {
      businessId = biz.id;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!businessId) {
    // Fallback : crée la row business manuellement si le trigger n'a pas tiré.
    const { data: created, error: createBizErr } = await admin
      .from("businesses")
      .insert({
        owner_id: newUserId,
        name: businessName,
        is_active: true,
      })
      .select("id")
      .single();
    if (createBizErr || !created) {
      console.error("[admin/create-test-account] business insert failed:", createBizErr);
      return NextResponse.json(
        { error: "Compte créé mais business introuvable" },
        { status: 500 }
      );
    }
    businessId = created.id;
  }

  // 5. Force le plan Business actif jusqu'en 2126 + onboarding completed
  //    pour bypasser le wizard.
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 100);
  const farFutureIso = farFuture.toISOString();

  const { error: updateErr } = await admin
    .from("businesses")
    .update({
      subscription_status: "active",
      subscription_plan: "business",
      subscription_current_period_end: farFutureIso,
      trial_ends_at: farFutureIso,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (updateErr) {
    console.error("[admin/create-test-account] update business failed:", updateErr);
    return NextResponse.json(
      { error: "Compte créé mais activation Business échouée" },
      { status: 500 }
    );
  }

  return NextResponse.json({ email, password });
}
