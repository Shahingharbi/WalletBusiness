"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickContrast } from "@/lib/utils";

interface InstallFormProps {
  cardId: string;
  accentColor: string;
  businessName?: string;
}

export function InstallForm({ cardId, accentColor, businessName }: InstallFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Le prénom est requis");
      return;
    }
    if (!consent) {
      setError("Vous devez accepter le traitement de vos données pour recevoir votre carte de fidélité.");
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
          consent: true,
        }),
      });

      const data = await res.json();

      // 409 = already installed — the API returns the existing instance_token
      // so we can land the user directly on their status page.
      if (res.status === 409 && data.instance_token) {
        router.push(`/c/${cardId}/status/${data.instance_token}`);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      router.push(`/c/${cardId}/status/${data.instance_token}`);
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Prénom"
        placeholder="Votre prénom"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />
      <Input
        label="Téléphone"
        placeholder="06 12 34 56 78"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint="Optionnel - pour recevoir des notifications"
      />

      {/* Consent RGPD obligatoire — base légale du traitement (art. 6.1.a
          RGPD). Le commerçant est responsable de traitement, aswallet est
          sous-traitant. Doit être un opt-in actif (case à cocher), pas une
          phrase d'acceptation tacite (qui n'est PAS un consentement valide
          au sens CNIL). */}
      <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 cursor-pointer flex-shrink-0"
          style={{ accentColor }}
        />
        <span>
          J&apos;accepte que mes données (prénom{phone.trim() ? ", téléphone" : ""}) soient
          traitées par <strong>{businessName || "ce commerce"}</strong> pour la gestion de ma
          carte de fidélité. Plus d&apos;infos dans la{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-black"
          >
            politique de confidentialité
          </a>
          .
        </span>
      </label>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        loading={loading}
        disabled={!firstName.trim() || !consent}
        className="w-full text-base font-semibold"
        style={{
          backgroundColor: accentColor,
          color: pickContrast(accentColor),
        }}
      >
        Obtenir ma carte de fidélité
      </Button>
    </form>
  );
}
