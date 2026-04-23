"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  MAX_STAMPS,
  MIN_STAMPS,
  BARCODE_TYPES,
  EXPIRATION_TYPES,
  type CardType,
} from "@/lib/constants";

export interface CardSettings {
  name: string;
  stampCount: number;
  rewardText: string;
  barcodeType: "qr" | "pdf417";
  expirationType: "unlimited" | "fixed_date" | "days_after_install";
  expirationDate: string;
  expirationDays: number;
}

interface StepSettingsProps {
  values: CardSettings;
  onChange: (values: CardSettings) => void;
  errors?: Partial<Record<keyof CardSettings, string>>;
  cardType?: CardType;
}

const TYPE_COPY: Record<CardType, {
  namePlaceholder: string;
  rewardLabel: string;
  rewardPlaceholder: string;
  countLabel?: string;
  showCount: boolean;
}> = {
  stamp: {
    namePlaceholder: "Ex: Carte Tampon Kebab",
    rewardLabel: "Récompense",
    rewardPlaceholder: "Ex: Un kebab offert !",
    countLabel: "Nombre de tampons",
    showCount: true,
  },
  cashback: {
    namePlaceholder: "Ex: Cashback Boulangerie",
    rewardLabel: "Description du cashback",
    rewardPlaceholder: "Ex: 5% cashback sur chaque achat",
    countLabel: "Nombre de visites avant cashback",
    showCount: true,
  },
  discount: {
    namePlaceholder: "Ex: Carte VIP Salon",
    rewardLabel: "Avantage permanent",
    rewardPlaceholder: "Ex: -10% sur tous vos achats",
    showCount: false,
  },
  membership: {
    namePlaceholder: "Ex: Adhésion Premium 2026",
    rewardLabel: "Avantages membre",
    rewardPlaceholder: "Ex: Accès illimité + réductions partenaires",
    showCount: false,
  },
  reward: { namePlaceholder: "", rewardLabel: "", rewardPlaceholder: "", showCount: false },
  coupon: { namePlaceholder: "", rewardLabel: "", rewardPlaceholder: "", showCount: false },
  gift: { namePlaceholder: "", rewardLabel: "", rewardPlaceholder: "", showCount: false },
  multipass: { namePlaceholder: "", rewardLabel: "", rewardPlaceholder: "", showCount: false },
};

export function StepSettings({ values, onChange, errors, cardType = "stamp" }: StepSettingsProps) {
  const copy = TYPE_COPY[cardType];
  const update = <K extends keyof CardSettings>(
    key: K,
    val: CardSettings[K]
  ) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Paramètres</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configurez les détails de votre carte
        </p>
      </div>

      {/* Card name */}
      <Input
        label="Nom de la carte"
        placeholder={copy.namePlaceholder}
        value={values.name}
        onChange={(e) => update("name", e.target.value)}
        error={errors?.name}
      />

      {/* Stamp count - only for stamp/cashback */}
      {copy.showCount && (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {copy.countLabel} ({values.stampCount})
        </label>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
          {Array.from({ length: MAX_STAMPS - MIN_STAMPS + 1 }, (_, i) => {
            const num = i + MIN_STAMPS;
            const isSelected = values.stampCount === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => update("stampCount", num)}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "bg-black text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Reward text */}
      <Input
        label={copy.rewardLabel}
        placeholder={copy.rewardPlaceholder}
        value={values.rewardText}
        onChange={(e) => update("rewardText", e.target.value)}
        error={errors?.rewardText}
      />

      {/* Barcode type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Type de code-barres
        </label>
        <div className="flex gap-3">
          {(Object.entries(BARCODE_TYPES) as [keyof typeof BARCODE_TYPES, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => update("barcodeType", key)}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all duration-150 cursor-pointer",
                  values.barcodeType === key
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                )}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Expiration */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Expiration
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          {(
            Object.entries(EXPIRATION_TYPES) as [
              keyof typeof EXPIRATION_TYPES,
              string,
            ][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => update("expirationType", key)}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all duration-150 cursor-pointer",
                values.expirationType === key
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {values.expirationType === "fixed_date" && (
          <Input
            type="date"
            label="Date d'expiration"
            value={values.expirationDate}
            onChange={(e) => update("expirationDate", e.target.value)}
          />
        )}

        {values.expirationType === "days_after_install" && (
          <Input
            type="number"
            label="Nombre de jours après installation"
            value={String(values.expirationDays)}
            onChange={(e) =>
              update("expirationDays", parseInt(e.target.value) || 1)
            }
            min={1}
          />
        )}
      </div>
    </div>
  );
}
