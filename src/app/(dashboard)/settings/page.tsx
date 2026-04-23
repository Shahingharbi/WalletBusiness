import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SettingsForms } from "./settings-forms";
import { InvitationsManager } from "./invitations-manager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone, business_id, role")
    .eq("id", user!.id)
    .single();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, category, address, city, postal_code, phone, logo_url")
    .eq("id", profile!.business_id)
    .single();

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, status, token, created_at, expires_at, accepted_at")
    .eq("business_id", profile!.business_id)
    .order("created_at", { ascending: false });

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("business_id", profile!.business_id)
    .eq("role", "employee");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerez votre profil, votre commerce et vos employes.
        </p>
      </div>

      <SettingsForms
        profile={{
          first_name: profile?.first_name ?? "",
          last_name: profile?.last_name ?? "",
          phone: profile?.phone ?? "",
          email: user?.email ?? "",
        }}
        business={{
          name: business?.name ?? "",
          category: business?.category ?? "",
          address: business?.address ?? "",
          city: business?.city ?? "",
          postal_code: business?.postal_code ?? "",
          phone: business?.phone ?? "",
          logo_url: business?.logo_url ?? null,
        }}
        canEditBusiness={profile?.role === "business_owner"}
      />

      {profile?.role === "business_owner" && (
        <InvitationsManager
          invitations={invitations ?? []}
          employees={employees ?? []}
        />
      )}

      <Link
        href="/settings/data"
        className="flex items-center justify-between gap-3 rounded-2xl border border-beige-dark bg-white p-5 hover:border-foreground transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-beige flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              Donnees et confidentialite
            </p>
            <p className="text-xs text-gray-500">
              Exporter ou supprimer vos donnees (RGPD)
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-700 transition-colors" />
      </Link>
    </div>
  );
}
