"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function DataPrivacyActions() {
  const router = useRouter();
  const toast = useToast();

  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", { method: "GET" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'export");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `aswallet-export-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Export téléchargé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm !== "SUPPRIMER") {
      toast.error("Tapez SUPPRIMER pour confirmer");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "SUPPRIMER" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur");

      toast.success("Compte supprimé. Au revoir.");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleExport} loading={exporting}>
          Télécharger mes données (JSON)
        </Button>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-red-700 mb-1">Zone dangereuse</h3>
        <p className="text-sm text-gray-600 mb-3">
          La suppression de votre compte est définitive. Toutes vos données
          (commerce, cartes, clients, transactions) seront effacées
          immédiatement et ne pourront pas être récupérées.
        </p>

        {!deleteOpen ? (
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Supprimer mon compte
          </Button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm text-red-900 font-medium">
              Pour confirmer, tapez <code className="px-1 bg-white rounded">SUPPRIMER</code> ci-dessous.
            </p>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="SUPPRIMER"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                loading={deleting}
                disabled={confirm !== "SUPPRIMER"}
              >
                Confirmer la suppression définitive
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteOpen(false);
                  setConfirm("");
                }}
                disabled={deleting}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
