"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardPreview } from "@/components/cards/card-preview";
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
}

export function EditCardForm({
  cardId,
  cardType,
  initialSettings,
  initialDesign,
  status,
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
          design,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Modifications enregistrees");
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
      toast.success("Carte archivee");
      router.push("/cards");
    } catch {
      toast.error("Erreur lors de l'archivage");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push(`/cards/${cardId}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Modifier la carte</h1>
      </div>

      {status === "active" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Cette carte est active. Les modifications seront visibles immediatement
          pour les clients qui ont deja installe la carte.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 lg:w-[60%] space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <StepSettings
              values={settings}
              onChange={setSettings}
              cardType={cardType}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <StepDesign values={design} onChange={setDesign} />
          </div>

          <div className="flex items-center justify-between">
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
              Apercu en direct
            </p>
            <CardPreview
              cardName={settings.name || "Ma carte"}
              stampCount={settings.stampCount}
              rewardText={settings.rewardText || "Votre recompense"}
              design={design}
              cardType={cardType}
              barcodeType={settings.barcodeType}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
