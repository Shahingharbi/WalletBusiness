"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
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
          reward_subtitle: settings.rewardSubtitle.trim() || null,
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
        rewardSubtitle={settings.rewardSubtitle}
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
            <StepDesign values={design} onChange={setDesign} />
          </div>

          {/* Desktop action row */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={archive}
              disabled={archiving || status === "archived"}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {archiving ? "..." : "Archiver"}
            </Button>
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
          <Button
            variant="ghost"
            onClick={archive}
            disabled={archiving || status === "archived"}
            className="text-red-600 hover:bg-red-50 flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {archiving ? "..." : "Archiver"}
          </Button>
          <Button onClick={save} disabled={saving} className="flex-[1.4]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
