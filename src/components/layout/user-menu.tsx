"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  variant?: "topbar" | "sidebar";
  compact?: boolean;
}

export function UserMenu({ user, variant = "topbar", compact = false }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full transition-colors cursor-pointer",
          variant === "topbar"
            ? "p-1 pr-3 hover:bg-beige-dark"
            : "w-full p-2 hover:bg-beige-dark"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="h-8 w-8 rounded-full bg-yellow text-foreground flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        {!compact && (
          <>
            <div className="hidden sm:flex flex-col items-start leading-tight min-w-0">
              <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {user.email}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 rounded-xl bg-white border border-border shadow-lg py-1.5 animate-fade-in-up",
            variant === "topbar"
              ? "right-0 top-full mt-2"
              : "left-full bottom-0 ml-2"
          )}
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-beige transition-colors"
            role="menuitem"
          >
            <Settings className="h-4 w-4" />
            Parametres
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Deconnexion..." : "Deconnexion"}
          </button>
        </div>
      )}
    </div>
  );
}
