"use client";

import { useState } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import { STAMP_ICONS, type StampIconKey } from "@/lib/stamp-icons";
import { COLOR_PRESETS, findMatchingPreset } from "@/lib/color-presets";
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
          className="h-11 w-11 rounded-lg border border-gray-300 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-11 flex-1 sm:w-28 sm:flex-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
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
  const matchedPreset = findMatchingPreset(
    values.background_color,
    values.accent_color
  );
  const [advancedOpen, setAdvancedOpen] = useState(!matchedPreset);

  const applyPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
    onChange({
      ...values,
      background_color: preset.background_color,
      accent_color: preset.accent_color,
      ...(preset.text_color ? { text_color: preset.text_color } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Design</h2>
        <p className="text-sm text-gray-500 mt-1">
          Personnalisez l&apos;apparence de votre carte
        </p>
      </div>

      {/* Color presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Palette de couleurs
          </label>
          {matchedPreset && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <Sparkles className="h-3 w-3" />
              {matchedPreset.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const isSel = matchedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                title={preset.label}
                aria-label={preset.label}
                className={cn(
                  "group relative flex flex-col items-center gap-1.5 cursor-pointer transition-all"
                )}
              >
                <div
                  className={cn(
                    "relative h-12 w-12 rounded-full border-2 shadow-sm overflow-hidden transition-all",
                    isSel
                      ? "border-black scale-110 shadow-md"
                      : "border-white group-hover:scale-105"
                  )}
                  style={{ backgroundColor: preset.background_color }}
                >
                  {/* Accent quarter */}
                  <div
                    className="absolute inset-y-0 right-0 w-1/2"
                    style={{ backgroundColor: preset.accent_color }}
                  />
                  {isSel && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 rounded-full bg-white/90 shadow flex items-center justify-center">
                        <Check className="h-3 w-3 text-black" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight text-center truncate w-full",
                    isSel ? "text-gray-900 font-semibold" : "text-gray-500"
                  )}
                >
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 mt-1 cursor-pointer"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              advancedOpen && "rotate-180"
            )}
          />
          {advancedOpen ? "Masquer" : "Couleurs personnalisées"}
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
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
        )}
      </div>

      {/* Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label='Label "tampons"'
          value={values.label_stamps}
          onChange={(e) => update("label_stamps", e.target.value)}
          placeholder="Tampons avant récompense"
          hint="Affiché au-dessus des tampons sur la carte"
        />
        <Input
          label='Label "récompenses"'
          value={values.label_rewards}
          onChange={(e) => update("label_rewards", e.target.value)}
          placeholder="Récompenses disponibles"
          hint="Texte court visible dans le wallet"
        />
      </div>

      {/* Upload zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <ImageUpload
            label="Logo"
            value={values.logo_url}
            onChange={(url) => update("logo_url", url)}
            folder="logos"
            aspect="square"
            kind="logo"
            hint={
              values.logo_url
                ? "Pour un rendu pro : utilisez un PNG sans fond."
                : "PNG carré 200×200 minimum. Pour un rendu pro, fond transparent."
            }
          />
          <p className="text-[11px] text-gray-500 leading-snug">
            💡 Pas de logo sans fond ? Rendez le vôtre transparent gratuitement sur{" "}
            <a
              href="https://www.remove.bg/upload"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-black underline underline-offset-2"
            >
              remove.bg
            </a>{" "}
            puis re-uploadez ici.
          </p>
        </div>
        <ImageUpload
          label="Bannière / image de fond"
          value={values.banner_url}
          onChange={(url) => update("banner_url", url)}
          folder="banners"
          aspect="wide"
          kind="banner"
          hint={
            values.banner_url
              ? "Un voile sombre sera ajouté pour lisibilité"
              : "Photo large (1125×432). Une image d'ambiance de votre commerce fonctionne très bien."
          }
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
          kind="stamp"
          hint={
            values.stamp_active_url
              ? "Remplace le style ci-dessus"
              : "Optionnel — remplace l'icône par une image perso (ex: votre logo en mini)."
          }
        />
        <ImageUpload
          label="Tampon vide (image, optionnel)"
          value={values.stamp_inactive_url}
          onChange={(url) => update("stamp_inactive_url", url)}
          folder="stamps"
          aspect="square"
          kind="stamp"
          hint={
            values.stamp_inactive_url
              ? undefined
              : "Optionnel — image affichée pour les tampons non encore obtenus."
          }
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
          className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
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
