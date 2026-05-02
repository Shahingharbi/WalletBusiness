"use client";

import { useState } from "react";
import { Clock, Trophy, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { AutoPushSettings } from "@/app/api/cards/[id]/auto-push/route";

interface Props {
  cardId: string;
  rewardText: string;
  stampCount: number;
  initialSettings: AutoPushSettings;
}

interface FormState {
  inactive_30d: { enabled: boolean; message: string };
  near_reward_80: { enabled: boolean; message: string };
  birthday: { enabled: boolean; message: string };
}

const DEFAULT_MESSAGES = {
  inactive_30d: "On vous a manqué ! Revenez profiter de {reward}",
  near_reward_80: "Plus que {remaining} tampons pour gagner {reward} !",
  birthday: "Joyeux anniversaire {name} ! Voici une récompense rien que pour vous.",
} as const;

export function AutoPushClient({ cardId, initialSettings }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/auto-push`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      <TriggerCard
        icon={<Clock className="h-5 w-5" />}
        title="Relance clients inactifs (30 j+)"
        description="Une notification est envoyée aux clients qui n'ont pas scanné depuis 30 jours. Cooldown de 30 jours par client."
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

interface TriggerCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  message: string;
  onEnabledChange: (v: boolean) => void;
  onMessageChange: (v: string) => void;
}

function TriggerCard({
  icon,
  title,
  description,
  enabled,
  message,
  onEnabledChange,
  onMessageChange,
}: TriggerCardProps) {
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
              <label className="inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onEnabledChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-10 h-6 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors">
                  <div className="absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            disabled={!enabled}
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
