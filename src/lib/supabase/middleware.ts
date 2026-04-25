import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Routes publiques (pas d'auth requise)
  const publicRoutes = ["/c/", "/api/install/"];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));
  if (isPublicRoute) return supabaseResponse;

  // Routes auth (login, register) : redirect si deja connecte
  const authRoutes = ["/login", "/register", "/forgot-password"];
  const isAuthRoute = authRoutes.some((route) => path.startsWith(route));

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Routes protegees : redirect si pas connecte
  const protectedRoutes = ["/dashboard", "/cards", "/clients", "/settings", "/scanner", "/admin", "/onboarding"];
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Pour "/" : si deja loggé, rediriger vers /dashboard.
  // Sinon laisser passer (la landing page est affichee).
  if (path === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Onboarding redirect : si l'utilisateur est connecte, n'a pas termine
  // l'onboarding et tente d'acceder au dashboard, on le pousse vers /onboarding.
  // Si à l'inverse il a deja termine et veut retourner sur /onboarding, on le ramene.
  if (user) {
    const onboardingGated = path === "/dashboard" || path.startsWith("/dashboard/");
    if (onboardingGated || path === "/onboarding" || path.startsWith("/onboarding/")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id, role")
        .eq("id", user.id)
        .maybeSingle();

      // Employees skip onboarding entirely
      if (profile?.role !== "employee" && profile?.business_id) {
        const { data: business } = await supabase
          .from("businesses")
          .select("onboarding_completed_at")
          .eq("id", profile.business_id)
          .maybeSingle();

        const onboardingDone = !!business?.onboarding_completed_at;

        if (!onboardingDone && onboardingGated) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          return NextResponse.redirect(url);
        }
        if (onboardingDone && (path === "/onboarding" || path.startsWith("/onboarding/"))) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Trial / subscription gate
  // ---------------------------------------------------------------------------
  // Si le commerce n'a pas d'abonnement actif et que l'essai est expiré, on
  // bloque l'accès aux routes d'écriture/scan et on redirige vers
  // /settings/billing. /dashboard et /settings/billing restent accessibles
  // pour permettre la souscription.
  if (user && isProtectedRoute) {
    const allowedAfterLockout = [
      "/settings/billing",
      "/dashboard",
      "/api/billing",
      "/api/account",
      "/auth",
      "/onboarding",
    ];
    const isAllowed = allowedAfterLockout.some((route) =>
      path.startsWith(route)
    );

    if (!isAllowed) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.business_id && profile.role === "business_owner") {
        const { data: business } = await supabase
          .from("businesses")
          .select("subscription_status, trial_ends_at")
          .eq("id", profile.business_id)
          .maybeSingle();

        if (business) {
          const status = business.subscription_status;
          const isActive = status === "active" || status === "trialing";
          const trialEnd = business.trial_ends_at
            ? new Date(business.trial_ends_at).getTime()
            : null;
          const trialOk = trialEnd !== null && trialEnd > Date.now();

          if (!isActive && !trialOk) {
            const url = request.nextUrl.clone();
            url.pathname = "/settings/billing";
            url.searchParams.set("locked", "1");
            return NextResponse.redirect(url);
          }
        }
      }
    }
  }

  return supabaseResponse;
}
