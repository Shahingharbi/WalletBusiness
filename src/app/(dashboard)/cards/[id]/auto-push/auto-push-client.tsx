"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Trophy, Cake, Star, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { AutoPushSettings } from "@/app/api/cards/[id]/auto-push/route";
import {
  REVIEW_DEFAULT_DELAY,
  REVIEW_DEFAULT_MESSAGE,
  REVIEW_DELAY_OPTIONS,
  REVIEW_MESSAGE_MAX,
  REVIEW_URL_MAX,
  isValidReviewUrl,
} from "@/lib/google-review";

interface Props {
  cardId: string;
  rewardText: string;
  stampCount: number;
  initialSettings: AutoPushSettings;
  /** Relances événementielles incluses dans le plan (Pro+). */
  autoPushAllowed: boolean;
  /** Nombre de demandes d'avis Google déjà envoyées pour cette carte. */
  reviewRequestsSent: number;
}

interface FormState {
  google_review: {
    enabled: boolean;
    url: string;
    message: string;
    delay_minutes: number;
  };
  inactive_30d: { enabled: boolean; message: string };
  near_reward_80: { enabled: boolean; message: string };
  birthday: { enabled: boolean; message: string };
}

const DEFAULT_MESSAGES = {
  inactive_30d: "On vous a manqué ! Revenez profiter de {reward}",
  near_reward_80: "Plus que {remaining} tampons pour gagner {reward} !",
  birthday: "Joyeux anniversaire {name} ! Voici une récompense rien que pour vous.",
} as const;

const DELAY_LABELS: Record<number, string> = {
  3: "3 minutes",
  10: "10 minutes",
  30: "30 minutes",
  60: "1 heure",
};

export function AutoPushClient({
  cardId,
  initialSettings,
  autoPushAllowed,
  reviewRequestsSent,
}: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    google_review: {
      enabled: initialSettings.google_review?.enabled ?? false,
      url: initialSettings.google_review?.url ?? "",
      message:
        initialSettings.google_review?.message?.trim() || REVIEW_DEFAULT_MESSAGE,
      delay_minutes:
        initialSettings.google_review?.delay_minutes ?? REVIEW_DEFAULT_DELAY,
    },
    inactive_30d: {
      enabled: initialSettings.inactive_30d?.enabled ?? true,
      message:
        initialSettings.inactive_30d?.message?.trim() ||
        DEFAULT_MESSAGES.inactive_30d,
    },
    near_reward_80: {
      enabled: initialSettings.near_reward_80?.enabled ?? true,
      message:
        initialSettings.near_reward_80?.message?.trim() ||
        DEFAULT_MESSAGES.near_reward_80,
    },
    birthday: {
      enabled: initialSettings.birthday?.enabled ?? true,
      message:
        initialSettings.birthday?.message?.trim() || DEFAULT_MESSAGES.birthday,
    },
  });

  const review = form.google_review;
  const setReview = (patch: Partial<FormState["google_review"]>) =>
    setForm({ ...form, google_review: { ...review, ...patch } });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = review.url.trim();
    if ((review.enabled || url) && !isValidReviewUrl(url)) {
      toast.error("Ajoutez un lien d'avis Google valide (commençant par https://).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/auto-push`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, google_review: { ...review, url } }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success("Pilote automatique enregistré");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="border-yellow">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow flex items-center justify-center text-foreground shrink-0">
              <Star className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">Demande d&apos;avis Google</p>
                <Toggle
                  checked={review.enabled}
                  onChange={(v) => setReview({ enabled: v })}
                  label="Activer la demande d'avis Google"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Quelques minutes après son passage, le client reçoit une
                notification avec le lien vers votre fiche Google. Une seule
                demande par client.
              </p>
              {reviewRequestsSent > 0 && (
                <p className="text-xs font-medium text-emerald-700 mt-1">
                  {reviewRequestsSent} demande{reviewRequestsSent > 1 ? "s" : ""}{" "}
                  envoyée{reviewRequestsSent > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="google-review-url"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Lien vers vos avis Google
            </label>
            <input
              id="google-review-url"
              type="url"
              inputMode="url"
              value={review.url}
              onChange={(e) => setReview({ url: e.target.value })}
              placeholder="https://g.page/r/…/review"
              maxLength={REVIEW_URL_MAX}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              Où le trouver : Google Maps → votre fiche → « Demander des avis »
              (ou Google Business Profile → « Partager le formulaire d&apos;avis »).
            </p>
          </div>

          <div>
            <label
              htmlFor="google-review-delay"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Envoyer après le passage
            </label>
            <select
              id="google-review-delay"
              value={review.delay_minutes}
              onChange={(e) => setReview({ delay_minutes: Number(e.target.value) })}
              disabled={!review.enabled}
              className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            >
              {REVIEW_DELAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {DELAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="google-review-message"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Message
            </label>
            <textarea
              id="google-review-message"
              value={review.message}
              onChange={(e) => setReview({ message: e.target.value })}
              disabled={!review.enabled}
              rows={2}
              maxLength={REVIEW_MESSAGE_MAX}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              {review.message.length} / {REVIEW_MESSAGE_MAX} — le lien est
              ajouté automatiquement à la fin. Variable : {"{name}"}
            </p>
          </div>
        </CardContent>
      </Card>

      <TriggerCard
        icon={<Clock className="h-5 w-5" />}
        title="Relance clients inactifs (30 j+)"
        description="Une notification est envoyée aux clients qui n'ont pas scanné depuis 30 jours. Cooldown de 30 jours par client."
        locked={!autoPushAllowed}
        enabled={form.inactive_30d.enabled}
        message={form.inactive_30d.message}
        onEnabledChange={(v) =>
          setForm({ ...form, inactive_30d: { ...form.inactive_30d, enabled: v } })
        }
        onMessageChange={(v) =>
          setForm({ ...form, inactive_30d: { ...form.inactive_30d, message: v } })
        }
      />

      <TriggerCard
        icon={<Trophy className="h-5 w-5" />}
        title="Encouragement avant récompense (80 %)"
        description="Quand un client a collecté au moins 80 % des tampons. Cooldown de 7 jours."
        locked={!autoPushAllowed}
        enabled={form.near_reward_80.enabled}
        message={form.near_reward_80.message}
        onEnabledChange={(v) =>
          setForm({
            ...form,
            near_reward_80: { ...form.near_reward_80, enabled: v },
          })
        }
        onMessageChange={(v) =>
          setForm({
            ...form,
            near_reward_80: { ...form.near_reward_80, message: v },
          })
        }
      />

      <TriggerCard
        icon={<Cake className="h-5 w-5" />}
        title="Anniversaire client"
        description="Le jour de son anniversaire (si renseigné). Cooldown de 365 jours."
        locked={!autoPushAllowed}
        enabled={form.birthday.enabled}
        message={form.birthday.message}
        onEnabledChange={(v) =>
          setForm({ ...form, birthday: { ...form.birthday, enabled: v } })
        }
        onMessageChange={(v) =>
          setForm({ ...form, birthday: { ...form.birthday, message: v } })
        }
      />

      <div className="flex justify-end gap-2 sticky bottom-0 bg-white border-t border-gray-100 py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:border-0">
        <Button type="submit" loading={saving} disabled={saving}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label
      className={`inline-flex items-center shrink-0 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        aria-label={label}
      />
      <span
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}

interface TriggerCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Plan trop bas : réglage visible mais non modifiable. */
  locked: boolean;
  enabled: boolean;
  message: string;
  onEnabledChange: (v: boolean) => void;
  onMessageChange: (v: string) => void;
}

function TriggerCard({
  icon,
  title,
  description,
  locked,
  enabled,
  message,
  onEnabledChange,
  onMessageChange,
}: TriggerCardProps) {
  const active = enabled && !locked;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-beige flex items-center justify-center text-foreground/70 shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-gray-900">{title}</p>
              <Toggle
                checked={active}
                onChange={onEnabledChange}
                disabled={locked}
                label={title}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
            {locked && (
              <Link
                href="/settings/billing"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2 hover:opacity-70"
              >
                <Lock className="h-3 w-3" />
                Inclus dans l&apos;offre Pro
              </Link>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            disabled={!active}
            rows={2}
            maxLength={200}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            {message.length} / 200 — variables: {"{name}"}, {"{reward}"},{" "}
            {"{remaining}"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
