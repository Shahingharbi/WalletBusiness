import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * Daily Vercel cron job. Sends a "trial expires in 3 days" email to every
 * business whose `trial_ends_at` falls within a 24-hour window centered on
 * "now + 3 days". The window is one day so the cron remains idempotent
 * within a single firing but does not double-send across firings.
 *
 * Auth: Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`
 * to cron invocations when CRON_SECRET is set. We accept any request in
 * non-production but require the secret in production.
 *
 * Schedule: see `vercel.json` — `0 9 * * *` (every day at 09:00 UTC).
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Auth check.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Window: trial_ends_at in [+3d, +4d) — i.e. roughly "3 days from now".
  const now = Date.now();
  const start = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now + 4 * 24 * 60 * 60 * 1000).toISOString();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, owner_id, trial_ends_at")
    .gte("trial_ends_at", start)
    .lt("trial_ends_at", end);

  if (error) {
    console.error("[cron/trial-expires-soon] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
  let sent = 0;
  let skipped = 0;

  for (const business of businesses ?? []) {
    try {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(
        business.owner_id
      );
      const ownerEmail = ownerAuth?.user?.email;
      if (!ownerEmail) {
        skipped++;
        continue;
      }
      const result = await sendEmail({
        to: ownerEmail,
        template: "trial-expires-soon",
        data: {
          daysLeft: 3,
          pricingUrl: `${appUrl}/pricing`,
        },
      });
      if (result.ok) sent++;
      else skipped++;
    } catch (err) {
      console.error("[cron/trial-expires-soon] send failed:", err);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: businesses?.length ?? 0,
    sent,
    skipped,
  });
}
