import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, business_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/scanner");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, logo_url, category")
    .eq("id", profile.business_id)
    .single();

  const userData = {
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    email: user.email ?? "",
    businessName: business?.name ?? "",
  };

  return <DashboardShell user={userData}>{children}</DashboardShell>;
}
