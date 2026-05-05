"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickContrast } from "@/lib/utils";

interface InstallFormProps {
  cardId: string;
  accentColor: string;
  /**
   * @deprecated le businessName n'est plus affiché dans le formulaire (la
   * checkbox RGPD a été supprimée pour réduire la friction). Conservé en
   * prop pour ne pas casser le call-site, mais inutilisé dans le rendu.
   */
  businessName?: string;
}

export function InstallForm({ cardId, accentColor, businessName }: InstallFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep prop available for forward-compat (the parent page may render it
  // elsewhere) but don't use it in the simplified form.
  void businessName;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Le prénom est requis");
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

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        loading={loading}
        disabled={!firstName.trim()}
        className="w-full text-base font-semibold"
        style={{
          backgroundColor: accentColor,
          // Auto-contraste : si l'accent est trop clair (luminance > 0.6),
          // on force le texte foncé pour rester lisible. Évite "bouton blanc
          // avec texte blanc invisible" quand le merchant choisit un accent
          // pâle (ex: pastel, blanc).
          color: pickContrast(accentColor),
        }}
      >
        Obtenir ma carte de fidélité
      </Button>

      <p className="text-[11px] leading-relaxed text-gray-500 text-center">
        En vous inscrivant, vous acceptez notre{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-black"
        >
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
}
