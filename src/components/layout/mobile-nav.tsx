"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface MobileNavUser {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: MobileNavUser;
}

const navItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cartes", href: "/cards", icon: CreditCard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Parametres", href: "/settings", icon: Settings },
];

export function MobileNav({ isOpen, onClose, user }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-beige shadow-xl flex flex-col transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-beige-dark">
          <span
            className="text-2xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-ginto-nord)" }}
          >
            FidPass
          </span>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-beige-dark transition-colors cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-full text-sm transition-colors duration-150",
                  isActive
                    ? "bg-yellow text-foreground font-semibold shadow-sm"
                    : "text-foreground/70 hover:bg-beige-dark hover:text-foreground"
                )}
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-beige-dark p-3 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-yellow text-foreground flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Deconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
