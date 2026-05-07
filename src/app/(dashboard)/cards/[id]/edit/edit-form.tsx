"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPreview } from "@/components/cards/card-preview";
import { MobileStickyPreview } from "@/components/cards/card-editor/mobile-sticky-preview";
import {
  StepSettings,
  type CardSettings,
} from "@/components/cards/card-editor/step-settings";
import {
  StepDesign,
  type CardDesign,
} from "@/components/cards/card-editor/step-design";
import type { CardType } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

interface EditCardFormProps {
  cardId: string;
  cardType: CardType;
  initialSettings: CardSettings;
  initialDesign: CardDesign;
  status: string;
  /** Nom du commerce — placeholder du champ "Nom dans le wallet". */
  businessName?: string;
}

export function EditCardForm({
  cardId,
  cardType,
  initialSettings,
  initialDesign,
  status,
  businessName,
}: EditCardFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState<CardSettings>(initialSettings);
  const [design, setDesign] = useState<CardDesign>(initialDesign);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [showDangerMenu, setShowDangerMenu] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          stamp_count: settings.stampCount,
          reward_text: settings.rewardText,
          barcode_type: settings.barcodeType,
          expiration_type: settings.expirationType,
          expiration_date: settings.expirationDate || null,
          expiration_days: settings.expirationDays || null,
          wallet_business_name: settings.walletBusinessName.trim() || null,
          design,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Modifications enregistrées");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!confirm("Archiver cette carte ? Elle ne sera plus accessible aux clients.")) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Carte archivée");
      router.push("/cards");
    } catch {
      toast.error("Erreur lors de l'archivage");
    } finally {
      setArchiving(false);
    }
  };

  /**
   * Suppression définitive : DELETE physique + cascade sur card_instances
   * + transactions + auto_push_log. Utile pour nettoyer les cartes test.
   * Le merchant doit taper le nom exact de la carte pour confirmer (évite
   * les clics accidentels sur les vraies cartes en prod).
   */
  const hardDelete = async () => {
    const expected = (initialSettings.name || "").trim();
    const typed = window.prompt(
      `Suppression DÉFINITIVE — irréversible.\n\nCette action supprime :\n• La carte elle-même\n• Tous les clients qui l'ont installée (${expected ? `« ${expected} »` : ""})\n• Toutes les transactions liées\n• Tous les logs auto-push\n\nPour confirmer, tapez le nom exact de la carte :`,
      "",
    );
    if (typed === null) return; // cancel
    if (typed.trim() !== expected) {
      toast.error("Nom de carte incorrect — suppression annulée.");
      return;
    }

    setHardDeleting(true);
    try {
      const res = await fetch(`/api/cards/${cardId}?hard=true`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "Erreur lors de la suppression",
        );
      }
      toast.success("Carte supprimée définitivement");
      router.push("/cards");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setHardDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 lg:pb-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push(`/cards/${cardId}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Modifier la carte</h1>
      </div>

      {status === "active" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Cette carte est active. Les modifications seront visibles immédiatement
          pour les clients qui ont déjà installé la carte.
        </div>
      )}

      {/* Mobile sticky preview */}
      <MobileStickyPreview
        cardName={settings.name || "Ma carte"}
        stampCount={settings.stampCount}
        rewardText={settings.rewardText || "Votre récompense"}
        design={design}
        cardType={cardType}
        barcodeType={settings.barcodeType}
        businessName={businessName}
        walletBusinessName={settings.walletBusinessName}
      />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 lg:w-[60%] min-w-0 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <StepSettings
              values={settings}
              onChange={setSettings}
              cardType={cardType}
              businessName={businessName}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <StepDesign values={design} onChange={setDesign} cardType={cardType} />
          </div>

          {/* Desktop action row */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowDangerMenu((v) => !v)}
                disabled={archiving || hardDeleting}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              {showDangerMenu && (
                <div
                  role="menu"
                  className="absolute left-0 bottom-full mb-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50 animate-fade-in-up"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowDangerMenu(false);
                      archive();
                    }}
                    disabled={status === "archived"}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      Archiver
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      La carte disparaît du dashboard mais reste en base. Les clients qui l&apos;ont installée gardent leur progression.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDangerMenu(false);
                      hardDelete();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-50 cursor-pointer mt-1"
                  >
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Supprimer définitivement
                    </p>
                    <p className="text-[11px] text-red-600/80 mt-0.5">
                      Suppression irréversible : carte + clients liés + transactions. À utiliser pour purger une carte de test.
                    </p>
                  </button>
                </div>
              )}
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="hidden lg:block lg:w-[40%]">
          <div className="sticky top-6">
            <p className="text-sm font-medium text-gray-500 text-center mb-4">
              Aperçu en direct
            </p>
            <CardPreview
              cardName={settings.name || "Ma carte"}
              stampCount={settings.stampCount}
              rewardText={settings.rewardText || "Votre récompense"}
              design={design}
              cardType={cardType}
              barcodeType={settings.barcodeType}
              businessName={businessName || undefined}
              walletBusinessName={settings.walletBusinessName}
            />
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar (mobile only) */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Button
              variant="ghost"
              onClick={() => setShowDangerMenu((v) => !v)}
              disabled={archiving || hardDeleting}
              className="text-red-600 hover:bg-red-50 w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            {showDangerMenu && (
              <div
                role="menu"
                className="absolute left-0 bottom-full mb-2 w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-50 animate-fade-in-up"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowDangerMenu(false);
                    archive();
                  }}
                  disabled={status === "archived"}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-amber-50 disabled:opacity-50 cursor-pointer"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    Archiver
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Disparaît du dashboard, reste en base.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDangerMenu(false);
                    hardDelete();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-red-50 cursor-pointer mt-1"
                >
                  <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Supprimer définitivement
                  </p>
                  <p className="text-[11px] text-red-600/80 mt-0.5">
                    Irréversible. Pour purger une carte test.
                  </p>
                </button>
              </div>
            )}
          </div>
          <Button onClick={save} disabled={saving} className="flex-[1.4]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
