"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface CreatedAccount {
  email: string;
  password: string;
}

export function AdminCreateAccountForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-test-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          business_name: businessName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du compte");
        return;
      }
      setCreated({ email: data.email, password: data.password });
      setEmail("");
      setFirstName("");
      setLastName("");
      setBusinessName("");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function copyValue(field: "email" | "password", value: string) {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div className="space-y-3">
      {created && (
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Compte créé — copiez les identifiants
          </p>
          <CredentialRow
            label="Email"
            value={created.email}
            copied={copiedField === "email"}
            onCopy={() => copyValue("email", created.email)}
          />
          <CredentialRow
            label="Mot de passe"
            value={created.password}
            copied={copiedField === "password"}
            onCopy={() => copyValue("password", created.password)}
            mono
          />
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Créer un autre compte
          </button>
        </div>
      )}

      {!created && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="demo@aswallet.fr"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jean"
              required
            />
            <Input
              label="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dupont"
              required
            />
          </div>
          <Input
            label="Nom du commerce"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Demo Boulangerie"
            required
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Créer le compte test
          </Button>
        </form>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
  mono = false,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-md border border-emerald-200 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          {label}
        </p>
        <p
          className={`text-sm text-foreground truncate ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copié
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copier
          </>
        )}
      </button>
    </div>
  );
}
