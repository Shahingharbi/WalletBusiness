"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Champ mot de passe avec toggle Eye/EyeOff intégré.
 *
 * Le label est rendu au-dessus, l'icône à droite ne déborde pas du champ
 * grâce à `padding-right`. Mobile-first : taille de tap 44px (h-11).
 */
export function PasswordInput({
  className,
  label,
  error,
  hint,
  id,
  ...props
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          className={cn(
            "flex h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-11 text-base sm:text-sm transition-colors duration-150",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-black transition-colors cursor-pointer"
          aria-label={
            show ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          tabIndex={-1}
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Calcule un score de force du mot de passe entre 0 et 4 selon longueur
 * et diversité (lowercase / uppercase / digit / special). Sert à colorier
 * la barre d'indicateur sous le champ.
 */
export function passwordStrength(pwd: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  if (!pwd) return { score: 0, label: "—", color: "bg-gray-200" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  let variety = 0;
  if (/[a-z]/.test(pwd)) variety++;
  if (/[A-Z]/.test(pwd)) variety++;
  if (/[0-9]/.test(pwd)) variety++;
  if (/[^a-zA-Z0-9]/.test(pwd)) variety++;
  score += Math.min(2, Math.max(0, variety - 1));
  const final = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"];
  const colors = [
    "bg-red-500",
    "bg-red-500",
    "bg-orange-400",
    "bg-emerald-400",
    "bg-emerald-600",
  ];
  return { score: final, label: labels[final], color: colors[final] };
}

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { score, label, color } = passwordStrength(password);
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? color : "bg-gray-200"
            )}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-[11px] text-gray-500">
          Force : <span className="font-medium text-gray-700">{label}</span>
        </p>
      )}
    </div>
  );
}
