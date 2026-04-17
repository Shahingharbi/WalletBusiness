"use client";

import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

export type CardDesign = typeof DEFAULT_CARD_DESIGN;

interface StepDesignProps {
  values: CardDesign;
  onChange: (values: CardDesign) => void;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
      </div>
    </div>
  );
}

export function StepDesign({ values, onChange }: StepDesignProps) {
  const update = <K extends keyof CardDesign>(key: K, val: CardDesign[K]) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Design</h2>
        <p className="text-sm text-gray-500 mt-1">
          Personnalisez l&apos;apparence de votre carte
        </p>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ColorField
          label="Couleur de fond"
          value={values.background_color}
          onChange={(v) => update("background_color", v)}
        />
        <ColorField
          label="Couleur du texte"
          value={values.text_color}
          onChange={(v) => update("text_color", v)}
        />
        <ColorField
          label="Couleur d'accent"
          value={values.accent_color}
          onChange={(v) => update("accent_color", v)}
        />
      </div>

      {/* Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label='Label "tampons"'
          value={values.label_stamps}
          onChange={(e) => update("label_stamps", e.target.value)}
          placeholder="Tampons avant recompense"
        />
        <Input
          label='Label "recompenses"'
          value={values.label_rewards}
          onChange={(e) => update("label_rewards", e.target.value)}
          placeholder="Recompenses disponibles"
        />
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ImageUpload
          label="Logo"
          value={values.logo_url}
          onChange={(url) => update("logo_url", url)}
          folder="logos"
          aspect="square"
        />
        <ImageUpload
          label="Banniere"
          value={values.banner_url}
          onChange={(url) => update("banner_url", url)}
          folder="banners"
          aspect="wide"
        />
      </div>
    </div>
  );
}
