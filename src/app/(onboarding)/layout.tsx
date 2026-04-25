import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingSignOut } from "./sign-out-button";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-beige flex flex-col">
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)" }}
        >
          aswallet
        </Link>
        <OnboardingSignOut />
      </header>
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-12">{children}</main>
    </div>
  );
}
