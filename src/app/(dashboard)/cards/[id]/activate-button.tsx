"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ActivateButtonProps {
  cardId: string;
}

export function ActivateButton({ cardId }: ActivateButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/activate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Erreur lors de l'activation");
      }
      toast.success("Carte activée ! Elle est maintenant installable par vos clients.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || isPending;

  return (
    <Button type="button" onClick={handle} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Power className="h-4 w-4 mr-2" />
      )}
      Activer
    </Button>
  );
}
