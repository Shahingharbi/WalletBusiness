"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

interface SidebarUser {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
}

interface SidebarProps {
  user: SidebarUser;
}

const navItems = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cartes", href: "/cards", icon: CreditCard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Parametres", href: "/settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col fixed left-0 top-0 h-screen bg-beige border-r border-beige-dark z-40 transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-beige-dark">
        <Link href="/dashboard" className="flex items-center gap-1">
          <span
            className={cn(
              "text-2xl font-bold tracking-tight transition-all duration-300 text-foreground",
              collapsed && "sr-only"
            )}
            style={{ fontFamily: "var(--font-ginto-nord)" }}
          >
            FidPass
          </span>
          {collapsed && (
            <span
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-ginto-nord)" }}
            >
              F
            </span>
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-beige-dark transition-colors cursor-pointer"
          aria-label={collapsed ? "Agrandir le menu" : "Reduire le menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-full text-sm transition-all duration-150",
                isActive
                  ? "bg-yellow text-foreground font-semibold shadow-sm"
                  : "text-foreground/70 hover:bg-beige-dark hover:text-foreground"
              )}
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "transition-all duration-300 whitespace-nowrap",
                  collapsed && "opacity-0 w-0 overflow-hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-beige-dark p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <UserMenu user={user} variant="sidebar" compact />
          </div>
        ) : (
          <UserMenu user={user} variant="sidebar" />
        )}
      </div>
    </aside>
  );
}
