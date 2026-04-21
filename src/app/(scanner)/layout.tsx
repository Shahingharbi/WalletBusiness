"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface UserInfo {
  firstName: string;
  businessName: string;
}

export default function ScannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, business_id")
        .eq("id", authUser.id)
        .single();

      if (!profile?.business_id) {
        router.push("/login");
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", profile.business_id)
        .single();

      setUser({
        firstName: profile.first_name ?? "",
        businessName: business?.name ?? "Commerce",
      });
      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900">a</span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">aswallet</p>
              <p className="text-gray-400 text-xs">{user?.businessName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            Deconnexion
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
