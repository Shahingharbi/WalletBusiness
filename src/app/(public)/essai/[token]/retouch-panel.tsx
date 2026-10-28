"use client";

/**
 * Panneau « Personnalisez-la en direct » : type de carte, textes (offre,
 * prénom, nom), couleurs, logo et photo. Chaque changement se voit
 * immédiatement sur l'aperçu ; l'enregistrement se fait tout seul.
 */

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Check,
  ImagePlus,
  LoaderCircle,
  Palette,
  Pipette,
  Store,
  Type,
  WandSparkles,
  LayoutGrid,
} from "lucide-react";
import { CardTypePicker } from "@/components/essai/card-type-picker";
import styles from "@/components/essai/essai-wallet.module.css";
import { cn, pickContrast } from "@/lib/utils";
import type { EssaiCardView, EssaiUpdateRequest } from "@/lib/essai/types";
import type { MediaKind, SaveState } from "./use-essai-view";

const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

export type RetouchTab = "type" | "texts" | "colors" | "images";

const TABS: ReadonlyArray<{ id: RetouchTab; label: string; icon: ReactNode }> = [
  { id: "type", label: "Type", icon: <LayoutGrid size={16} aria-hidden /> },
  { id: "texts", label: "Textes", icon: <Type size={16} aria-hidden /> },
  { id: "colors", label: "Couleurs", icon: <Palette size={16} aria-hidden /> },
  { id: "images", label: "Images", icon: <ImagePlus size={16} aria-hidden /> },
];

/** Fonds classiques des cartes Wallet (noir, crème, olive…). */
const BACKGROUND_PRESETS = [
  "#141414",
  "#f3efe6",
  "#6b6b47",
  "#1f3a2e",
  "#13294b",
  "#6e1f2b",
  "#b45309",
  "#ffffff",
];
const ACCENT_PRESETS = [
  "#f5b301",
  "#e11d48",
  "#16a34a",
  "#2563eb",
  "#c9a227",
  "#ea580c",
  "#ffffff",
  "#141414",
];

/** Temporisation de la saisie (PATCH limité à 40 / min). */
const TEXT_DELAY_MS = 450;
const OFFER_MAX = 60;
/** Au-delà, l'offre risque d'être coupée dans la rangée Apple Wallet. */
const OFFER_COMFORT = 34;
const NAME_MAX = 40;
const FIRST_NAME_MAX = 30;

function uniqueColors(list: string[], max: number): string[] {
  const out: string[] = [];
  for (const c of list) {
    const v = c.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function RetouchPanel({
  view,
  palette,
  tab,
  onTab,
  saveState,
  rewriting,
  mediaBusy,
  onUpdate,
  onFlush,
  onRewrite,
  onPick,
}: {
  view: EssaiCardView;
  /** Couleurs détectées sur la marque (pastilles « vos couleurs »). */
  palette: string[];
  tab: RetouchTab;
  onTab: (tab: RetouchTab) => void;
  saveState: SaveState;
  rewriting: boolean;
  mediaBusy: MediaKind | null;
  onUpdate: (patch: EssaiUpdateRequest, delayMs?: number) => void;
  onFlush: () => void;
  onRewrite: () => void;
  onPick: (kind: MediaKind) => void;
}) {
  const uid = useId();
  const tabRefs = useRef<Record<RetouchTab, HTMLButtonElement | null>>({
    type: null,
    texts: null,
    colors: null,
    images: null,
  });

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = TABS[next].id;
    onTab(id);
    tabRefs.current[id]?.focus();
  }

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-foreground/5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${uid}-title`} className="text-lg font-semibold text-foreground sm:text-xl" style={FONT_UI}>
          Personnalisez-la en direct
        </h2>
        <p className="flex min-h-[24px] items-center gap-1.5 text-xs text-muted-foreground" style={FONT_TEXT} aria-live="polite">
          {saveState === "saving" && (
            <>
              <LoaderCircle size={14} className="motion-safe:animate-spin" aria-hidden />
              Enregistrement…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check size={14} strokeWidth={3} className="text-emerald-600" aria-hidden />
              Enregistré
            </>
          )}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Que voulez-vous modifier ?"
        className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-beige p-1"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(node) => {
                tabRefs.current[t.id] = node;
              }}
              id={`${uid}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${uid}-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onTab(t.id)}
              onKeyDown={onTabKey}
              className={cn(
                "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground sm:flex-row sm:gap-1.5 sm:text-sm cursor-pointer",
                active ? "bg-white text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
              )}
              style={FONT_UI}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel-${tab}`}
        aria-labelledby={`${uid}-tab-${tab}`}
        tabIndex={0}
        className={cn("mt-5 rounded-xl focus-visible:outline-none", styles.riseIn)}
        key={tab}
      >
        {tab === "type" && (
          <CardTypePicker
            name={`${uid}-type`}
            legend="Type de carte"
            size="sm"
            value={view.cardType}
            onChange={(cardType) => onUpdate({ cardType })}
          />
        )}

        {tab === "texts" && (
          <div className="space-y-5">
            <LiveTextField
              label="Votre offre"
              value={view.rewardText}
              maxLength={OFFER_MAX}
              placeholder={"Ex. : 10 cafés achetés = 1 offert"}
              busy={rewriting}
              hint={
                view.rewardText.length > OFFER_COMFORT
                  ? "Astuce : une offre courte s'affiche en entier sur la carte."
                  : "Écrite pour votre métier et votre type de carte."
              }
              onLive={(v) => {
                const text = v.replace(/\s+/g, " ").trim();
                if (text) onUpdate({ rewardText: text }, TEXT_DELAY_MS);
              }}
              onCommit={onFlush}
              action={
                <button
                  type="button"
                  onClick={onRewrite}
                  disabled={rewriting}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-yellow px-3 text-sm font-semibold text-foreground transition-colors hover:bg-yellow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:cursor-wait disabled:opacity-70 cursor-pointer"
                  style={FONT_UI}
                >
                  {rewriting ? (
                    <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <WandSparkles size={16} aria-hidden />
                  )}
                  <span className="whitespace-nowrap">Écrire pour moi</span>
                </button>
              }
            />
            <LiveTextField
              label="Votre prénom"
              optional
              value={view.firstName ?? ""}
              maxLength={FIRST_NAME_MAX}
              placeholder={"Ex. : Shahin"}
              autoComplete="given-name"
              hint={"S'affiche à gauche de la carte : « Bonjour … ». Laissez vide pour le retirer."}
              onLive={(v) => {
                const text = v.replace(/\s+/g, " ").trim();
                onUpdate({ firstName: text || null }, TEXT_DELAY_MS);
              }}
              onCommit={onFlush}
            />
            <LiveTextField
              label="Nom du commerce"
              value={view.name}
              maxLength={NAME_MAX}
              placeholder={"Ex. : Boulangerie Martin"}
              autoComplete="organization"
              onLive={(v) => {
                const text = v.replace(/\s+/g, " ").trim();
                if (text) onUpdate({ name: text }, TEXT_DELAY_MS);
              }}
              onCommit={onFlush}
            />
          </div>
        )}

        {tab === "colors" && (
          <div className="space-y-6">
            <ColorChoice
              legend="Fond de la carte"
              name={`${uid}-bg`}
              value={view.colors.background}
              options={uniqueColors([...palette, ...BACKGROUND_PRESETS], 10)}
              onChange={(c, live) =>
                onUpdate({ colors: { background: c, text: pickContrast(c) } }, live ? 350 : 0)
              }
            />
            <ColorChoice
              legend="Tampons et détails"
              name={`${uid}-accent`}
              value={view.colors.accent}
              options={uniqueColors([...palette, ...ACCENT_PRESETS], 10)}
              onChange={(c, live) => onUpdate({ colors: { accent: c } }, live ? 350 : 0)}
            />
          </div>
        )}

        {tab === "images" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MediaCard
              title="Logo"
              hint="En haut à gauche de la carte."
              action="Remplacer le logo"
              busy={mediaBusy === "logo"}
              onPick={() => onPick("logo")}
              preview={
                view.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL dynamique (Supabase).
                  <img src={view.logoUrl} alt="Votre logo actuel" className="h-16 w-16 rounded-full object-cover ring-1 ring-foreground/10" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-beige">
                    <ImagePlus size={22} aria-hidden />
                  </span>
                )
              }
            />
            <MediaCard
              title="Photo de la bande"
              hint="Derrière vos tampons."
              action="Remplacer la photo"
              busy={mediaBusy === "photo"}
              onPick={() => onPick("photo")}
              preview={
                view.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL dynamique (Supabase).
                  <img src={view.photoUrl} alt="Votre photo actuelle" className="h-16 w-28 rounded-xl object-cover ring-1 ring-foreground/10" />
                ) : (
                  <span className="flex h-16 w-28 items-center justify-center rounded-xl bg-beige">
                    <Store size={22} aria-hidden />
                  </span>
                )
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Champs ───────────────────────────────────────────────────────────────

/**
 * Champ texte « en direct » : pendant la saisie, le texte tapé est gardé
 * localement (les réponses du serveur ne le font jamais sauter) ; à la
 * sortie du champ, on revient à la valeur de la carte.
 */
function LiveTextField({
  label,
  optional = false,
  value,
  maxLength,
  placeholder,
  hint,
  autoComplete = "off",
  busy = false,
  action,
  onLive,
  onCommit,
}: {
  label: string;
  optional?: boolean;
  value: string;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  busy?: boolean;
  action?: ReactNode;
  onLive: (value: string) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground" style={FONT_UI}>
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </label>
      <div className={cn("mt-2 flex gap-2", action && "flex-col items-start min-[440px]:flex-row min-[440px]:items-stretch")}>
        <div className="relative w-full min-w-0 flex-1">
          <input
            id={id}
            type="text"
            value={draft ?? value}
            maxLength={maxLength}
            placeholder={placeholder}
            autoComplete={autoComplete}
            enterKeyHint="done"
            aria-describedby={hint ? `${id}-hint` : undefined}
            aria-busy={busy || undefined}
            onFocus={() => setDraft(value)}
            onChange={(e) => {
              setDraft(e.target.value);
              onLive(e.target.value);
            }}
            onBlur={() => {
              setDraft(null);
              onCommit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="h-12 w-full rounded-xl border-2 border-border bg-white px-3.5 text-base text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-foreground"
            style={FONT_TEXT}
          />
          {busy && <span className={cn(styles.shimmer, "rounded-xl")} aria-hidden />}
        </div>
        {action}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-snug text-muted-foreground" style={FONT_TEXT}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ColorChoice({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: string[];
  /** `live` : sélecteur libre qu'on fait glisser (envoi temporisé). */
  onChange: (color: string, live: boolean) => void;
}) {
  const current = value.toLowerCase();
  const custom = !options.includes(current);
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground" style={FONT_UI}>
        {legend}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((c) => {
          const checked = c === current;
          return (
            <label
              key={c}
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground"
              title={c}
            >
              <input
                type="radio"
                name={name}
                value={c}
                checked={checked}
                onChange={() => onChange(c, false)}
                className="sr-only"
                aria-label={`Couleur ${c}`}
              />
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-foreground/15 transition-transform duration-200",
                  checked && "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-white"
                )}
                style={{ backgroundColor: c }}
                aria-hidden
              >
                {checked && <Check size={15} strokeWidth={3} color={pickContrast(c)} className={styles.checkPop} />}
              </span>
            </label>
          );
        })}
        <label
          className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground"
          title="Autre couleur"
        >
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#141414"}
            onChange={(e) => onChange(e.target.value.toLowerCase(), true)}
            className="sr-only"
            aria-label={`${legend} : autre couleur`}
          />
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-foreground/15",
              custom && "ring-2 ring-foreground ring-offset-2 ring-offset-white"
            )}
            style={{
              background: custom
                ? current
                : "conic-gradient(from 90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)",
            }}
            aria-hidden
          >
            <Pipette size={15} color={custom ? pickContrast(current) : "#ffffff"} strokeWidth={2.4} />
          </span>
        </label>
      </div>
    </fieldset>
  );
}

function MediaCard({
  title,
  hint,
  action,
  busy,
  preview,
  onPick,
}: {
  title: string;
  hint: string;
  action: string;
  busy: boolean;
  preview: ReactNode;
  onPick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-beige p-3">
      <span className="relative shrink-0">
        {preview}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60">
            <LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden />
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground" style={FONT_UI}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground" style={FONT_TEXT}>
          {hint}
        </p>
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          aria-busy={busy || undefined}
          className="-ml-1 mt-0.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:cursor-wait disabled:no-underline disabled:opacity-60 cursor-pointer"
          style={FONT_UI}
        >
          {busy ? "Mise en place…" : action}
        </button>
      </div>
    </div>
  );
}
