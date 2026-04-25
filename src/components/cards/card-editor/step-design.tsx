"use client";

import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import { STAMP_ICONS, type StampIconKey } from "@/lib/stamp-icons";
import { cn } from "@/lib/utils";

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

const SHAPES: Array<{
  key: CardDesign["stamp_shape"];
  label: string;
  cls: string;
  style?: React.CSSProperties;
}> = [
  { key: "circle", label: "Rond", cls: "rounded-full" },
  { key: "squircle", label: "Squircle", cls: "rounded-[35%]" },
  { key: "shield", label: "Écusson", cls: "rounded-t-full rounded-b-md" },
  {
    key: "star",
    label: "Étoile",
    cls: "",
    style: {
      clipPath:
        "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
    },
  },
  {
    key: "hex",
    label: "Hexagone",
    cls: "",
    style: { clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)" },
  },
];

export function StepDesign({ values, onChange }: StepDesignProps) {
  const update = <K extends keyof CardDesign>(key: K, val: CardDesign[K]) => {
    onChange({ ...values, [key]: val });
  };

  const accent = values.accent_color || "#e53e3e";
  const selectedIconKey = (values.stamp_icon || "check") as StampIconKey;

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
        <ColorField label="Couleur de fond" value={values.background_color} onChange={(v) => update("background_color", v)} />
        <ColorField label="Couleur du texte" value={values.text_color} onChange={(v) => update("text_color", v)} />
        <ColorField label="Couleur d'accent" value={values.accent_color} onChange={(v) => update("accent_color", v)} />
      </div>

      {/* Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label='Label "tampons"'
          value={values.label_stamps}
          onChange={(e) => update("label_stamps", e.target.value)}
          placeholder="Tampons avant récompense"
        />
        <Input
          label='Label "récompenses"'
          value={values.label_rewards}
          onChange={(e) => update("label_rewards", e.target.value)}
          placeholder="Récompenses disponibles"
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
          hint="Carré, fond transparent recommandé"
        />
        <ImageUpload
          label="Bannière / image de fond"
          value={values.banner_url}
          onChange={(url) => update("banner_url", url)}
          folder="banners"
          aspect="wide"
          hint="Un voile sombre sera ajouté pour lisibilité"
        />
      </div>

      {/* Stamp icon */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Style de tampon
        </label>
        <div className="grid grid-cols-7 gap-2">
          {(Object.entries(STAMP_ICONS) as Array<[StampIconKey, { label: string; Icon: React.FC<{ className?: string }> }]>).map(
            ([key, { Icon, label }]) => {
              const isSel = selectedIconKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update("stamp_icon", key)}
                  title={label}
                  className={cn(
                    "aspect-square rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                    isSel
                      ? "border-black shadow-sm scale-105"
                      : "border-gray-200 hover:border-gray-400 bg-white"
                  )}
                  style={isSel ? { backgroundColor: `${accent}12` } : undefined}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Stamp shape */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Forme du tampon
        </label>
        <div className="grid grid-cols-5 gap-2">
          {SHAPES.map((s) => {
            const isSel = values.stamp_shape === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => update("stamp_shape", s.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all cursor-pointer",
                  isSel
                    ? "border-black shadow-sm"
                    : "border-gray-200 hover:border-gray-400 bg-white"
                )}
              >
                <div
                  className={cn("h-7 w-7", s.cls)}
                  style={{
                    backgroundColor: accent,
                    ...(s.style ?? {}),
                  }}
                />
                <span className="text-[10px] text-gray-600">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom stamp images (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ImageUpload
          label="Tampon actif (image, optionnel)"
          value={values.stamp_active_url}
          onChange={(url) => update("stamp_active_url", url)}
          folder="stamps"
          aspect="square"
          hint="Remplace le style ci-dessus"
        />
        <ImageUpload
          label="Tampon vide (image, optionnel)"
          value={values.stamp_inactive_url}
          onChange={(url) => update("stamp_inactive_url", url)}
          folder="stamps"
          aspect="square"
        />
      </div>

      {/* Welcome offer (optional) */}
      <div className="space-y-1.5">
        <label
          htmlFor="welcome_reward"
          className="block text-sm font-medium text-gray-700"
        >
          Offre de bienvenue (optionnel)
        </label>
        <textarea
          id="welcome_reward"
          rows={2}
          maxLength={140}
          value={values.welcome_reward ?? ""}
          onChange={(e) => update("welcome_reward", e.target.value)}
          placeholder="Ex : -10% sur votre première commande, ou un café offert"
          className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500">
          Si renseigné, chaque nouveau client reçoit cette offre dès
          l&apos;installation : 1 récompense est créditée et un message wallet est
          envoyé automatiquement.
        </p>
      </div>
    </div>
  );
}
