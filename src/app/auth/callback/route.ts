import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback route. Receives the `code` + optional `next` after a user
 * completes the Supabase OAuth (PKCE) flow, exchanges the code for a session,
 * then redirects the user to `next` (defaults to `/dashboard`).
 *
 * The `handle_new_user` trigger in `supabase/migrations/001c_functions.sql`
 * automatically creates a `profiles` + `businesses` row on first sign-in, so
 * no post-signup wiring is needed here for OAuth users (business name falls
 * back to "Mon Commerce" when `raw_user_meta_data.business_name` is absent).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Only allow same-origin relative paths in `next` to avoid open-redirect.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Lien de connexion invalide")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
