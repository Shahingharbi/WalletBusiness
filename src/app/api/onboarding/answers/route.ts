import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface OnboardingAnswers {
  type?: string;
  estimated_clients?: string;
  goal?: string;
}

const ALLOWED_TYPES = new Set([
  "kebab",
  "boulangerie",
  "cafe",
  "restaurant",
  "coiffeur",
  "fleuriste",
  "autre",
  "",
]);
const ALLOWED_GOALS = new Set(["fidelisation", "push", "dashboard", ""]);
const ALLOWED_RANGES = new Set(["0-50", "50-200", "200-500", "500+", ""]);

function sanitize(body: OnboardingAnswers) {
  return {
    type: ALLOWED_TYPES.has(body.type ?? "") ? body.type ?? "" : "",
    estimated_clients: ALLOWED_RANGES.has(body.estimated_clients ?? "")
      ? body.estimated_clients ?? ""
      : "",
    goal: ALLOWED_GOALS.has(body.goal ?? "") ? body.goal ?? "" : "",
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as OnboardingAnswers;
    const data = sanitize(body);

    const { error } = await supabase
      .from("businesses")
      .update({ onboarding_data: data })
      .eq("id", profile.business_id);

    if (error) {
      return NextResponse.json(
        { error: "Sauvegarde impossible" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
