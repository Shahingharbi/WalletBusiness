"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

interface DashboardShellProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    businessName: string;
  };
  /**
   * Rôle du profil — sert à afficher l'item "Admin" dans la sidebar
   * uniquement pour les `super_admin`.
   */
  role?: string;
  children: React.ReactNode;
}

export function DashboardShell({ user, role, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleMenuClick = useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} role={role} />
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={handleClose}
        user={user}
        role={role}
      />

      <div className="md:pl-60">
        <Topbar
          user={user}
          businessName={user.businessName}
          onMenuClick={handleMenuClick}
        />
        <main className="p-4 md:p-6 bg-beige/40 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
