"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InstallFormProps {
  cardId: string;
  accentColor: string;
}

export function InstallForm({ cardId, accentColor }: InstallFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Le prenom est requis");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/install/${cardId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          phone: phone.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      router.push(`/c/${cardId}/status/${data.instance_token}`);
    } catch {
      setError("Erreur de connexion. Veuillez reessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Prenom"
        placeholder="Votre prenom"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />
      <Input
        label="Telephone"
        placeholder="06 12 34 56 78"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint="Optionnel - pour recevoir des notifications"
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        loading={loading}
        className="w-full text-base font-semibold"
        style={{ backgroundColor: accentColor }}
      >
        Obtenir ma carte de fidelite
      </Button>
    </form>
  );
}
