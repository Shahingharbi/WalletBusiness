"use client";

import { Menu, Bell } from "lucide-react";
import { UserMenu } from "./user-menu";

interface TopbarUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface TopbarProps {
  user: TopbarUser;
  businessName: string;
  onMenuClick: () => void;
}

export function Topbar({ user, businessName, onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center h-16 bg-white border-b border-beige-dark px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-lg text-foreground hover:bg-beige transition-colors cursor-pointer"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 ml-2 md:ml-0">
        <h2
          className="text-sm font-semibold text-foreground truncate"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          {businessName}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative p-2 rounded-full text-muted-foreground hover:bg-beige hover:text-foreground transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        <UserMenu user={user} variant="topbar" />
      </div>
    </header>
  );
}
