"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardPreview } from "@/components/cards/card-preview";
import { StepType } from "@/components/cards/card-editor/step-type";
import { StepTemplate } from "@/components/cards/card-editor/step-template";
import {
  StepSettings,
  type CardSettings,
} from "@/components/cards/card-editor/step-settings";
import {
  StepDesign,
  type CardDesign,
} from "@/components/cards/card-editor/step-design";
import {
  DEFAULT_CARD_DESIGN,
  DEFAULT_STAMPS,
  type CardType,
} from "@/lib/constants";
import type { CardTemplate } from "@/lib/card-templates";

const STEPS = [
  { id: 1, label: "Modele" },
  { id: 2, label: "Type" },
  { id: 3, label: "Parametres" },
  { id: 4, label: "Design" },
] as const;

interface FormState {
  type: CardType;
  settings: CardSettings;
  design: CardDesign;
  templateId: string | null;
}

const initialState: FormState = {
  type: "stamp",
  settings: {
    name: "",
    stampCount: DEFAULT_STAMPS,
    rewardText: "",
    barcodeType: "qr",
    expirationType: "unlimited",
    expirationDate: "",
    expirationDays: 30,
  },
  design: { ...DEFAULT_CARD_DESIGN },
  templateId: null,
};

export default function NewCardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTemplate = (tpl: CardTemplate) => {
    setForm({
      type: tpl.type,
      settings: {
        ...form.settings,
        name: tpl.name,
        stampCount: tpl.stampCount,
        rewardText: tpl.rewardText,
      },
      design: { ...tpl.design },
      templateId: tpl.id,
    });
  };

  const canProceed = () => {
    if (step === 1) return form.templateId !== null;
    if (step === 3) {
      return form.settings.name.trim().length > 0 && form.settings.rewardText.trim().length > 0;
    }
    return true;
  };

  const validateStep3 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.settings.name.trim()) errs.name = "Le nom de la carte est requis";
    if (!form.settings.rewardText.trim()) errs.rewardText = "La recompense est requise";
    return errs;
  };

  const handleNext = () => {
    if (step === 3) {
      const stepErrors = validateStep3();
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
      setErrors({});
    }
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          name: form.settings.name,
          max_stamps: form.settings.stampCount,
          reward_text: form.settings.rewardText,
          barcode_type: form.settings.barcodeType,
          expiration_type: form.settings.expirationType,
          expiration_date: form.settings.expirationDate || null,
          expiration_days: form.settings.expirationDays || null,
          design: form.design,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la creation");
      }

      router.push(`/cards/${data.card.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push("/cards")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle carte</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200",
                  step > s.id
                    ? "border-black bg-black text-white"
                    : step === s.id
                      ? "border-black bg-white text-black"
                      : "border-gray-300 bg-white text-gray-400"
                )}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-xs font-medium",
                  step >= s.id ? "text-gray-900" : "text-gray-400"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-colors duration-200",
                  step > s.id ? "bg-black" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Content: form + preview */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form area */}
        <div className="flex-1 lg:w-[60%]">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {step === 1 && (
              <StepTemplate
                selectedId={form.templateId}
                onSelect={handleTemplate}
              />
            )}
            {step === 2 && (
              <StepType
                value={form.type}
                onChange={(type) => setForm({ ...form, type })}
              />
            )}
            {step === 3 && (
              <StepSettings
                values={form.settings}
                onChange={(settings) => setForm({ ...form, settings })}
                errors={errors}
                cardType={form.type}
              />
            )}
            {step === 4 && (
              <StepDesign
                values={form.design}
                onChange={(design) => setForm({ ...form, design })}
              />
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>

              {step < 4 ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Creer la carte
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className="lg:w-[40%]">
          <div className="sticky top-6">
            <p className="text-sm font-medium text-gray-500 text-center mb-4">
              Apercu en direct
            </p>
            <CardPreview
              cardName={form.settings.name || "Ma carte"}
              stampCount={form.settings.stampCount}
              rewardText={form.settings.rewardText || "Votre recompense"}
              design={form.design}
              cardType={form.type}
              barcodeType={form.settings.barcodeType}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
