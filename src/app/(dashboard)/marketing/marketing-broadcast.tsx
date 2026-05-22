"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  AlertCircle,
  Gift,
  Cake,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type ActionKey = "inactive_30d" | "has_reward" | "birthdays";
type Segment = "all" | "inactive_30d" | "has_reward" | "never_redeemed";

interface ActionCard {
  key: ActionKey;
  title: string;
  count: number;
  countLabel: string;
  description: string;
  icon: typeof AlertCircle;
  iconBg: string;
  iconColor: string;
  cta: string;
  messageTemplate: string;
}

interface CardOption {
  id: string;
  name: string;
  stamp_count: number;
  reward_text: string;
}

interface MarketingBroadcastProps {
  actions: ActionCard[];
  cards: CardOption[];
}

/**
 * Wrapper client autour des 3 cards d'action suggérées + modal de
 * composition. Quand le merchant clique sur "Envoyer une relance", on
 * ouvre un modal pré-rempli avec le bon segment et un message template
 * personnalisable. L'envoi passe par l'API /api/campaigns existante.
 *
 * Action "Anniversaires" ne déclenche pas un envoi instantané (Apple +
 * Google ne permettent pas de cibler par anniversaire dans un push
 * one-shot) mais redirige vers la page auto-push d'une carte pour
 * activer le trigger birthday cron daily.
 */
export function MarketingBroadcast({ actions, cards }: MarketingBroadcastProps) {
  const [activeAction, setActiveAction] = useState<ActionCard | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const disabled = action.count === 0 || action.key === "birthdays";
          return (
            <div
              key={action.key}
              className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${action.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${action.iconColor}`} />
                </span>
                <div className="text-right">
                  <p
                    className="text-3xl text-foreground leading-none"
                    style={{
                      fontFamily: "var(--font-ginto-nord)",
                      fontWeight: 500,
                    }}
                  >
                    {action.count}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                    {action.countLabel}
                  </p>
                </div>
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                {action.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
                {action.description}
              </p>
              {action.key === "birthdays" ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={cards.length === 0}
                  onClick={() => {
                    // Pas de modal — on redirige vers la 1ere carte
                    // pour activer le trigger birthday.
                    if (cards.length > 0) {
                      window.location.href = `/cards/${cards[0].id}/auto-push`;
                    }
                  }}
                >
                  <Cake className="h-4 w-4 mr-2" />
                  {action.cta}
                </Button>
              ) : (
                <Button
                  onClick={() => setActiveAction(action)}
                  disabled={disabled || cards.length === 0}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {action.cta}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {activeAction && (
        <BroadcastModal
          action={activeAction}
          cards={cards}
          onClose={() => setActiveAction(null)}
        />
      )}
    </>
  );
}

function actionToSegment(key: ActionKey): Segment {
  switch (key) {
    case "inactive_30d":
      return "inactive_30d";
    case "has_reward":
      return "has_reward";
    case "birthdays":
      return "all";
  }
}

function BroadcastModal({
  action,
  cards,
  onClose,
}: {
  action: ActionCard;
  cards: CardOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedCardId, setSelectedCardId] = useState<string>(
    cards[0]?.id ?? "",
  );
  const [message, setMessage] = useState(action.messageTemplate);
  const [sending, setSending] = useState(false);

  const segment = actionToSegment(action.key);
  const maxChars = 200;
  const card = cards.find((c) => c.id === selectedCardId);

  // Templates personnalisés selon le contexte
  const templates: string[] = (() => {
    switch (action.key) {
      case "inactive_30d":
        return [
          "On vous a manqué ! 🎁 -10% pour vous remercier de revenir cette semaine.",
          "Ça fait un moment ! Profitez d'une offre spéciale rien que pour vous.",
          card
            ? `Hey ! Plus que quelques tampons pour gagner ${card.reward_text}. On vous attend.`
            : "On vous attend pour finir votre carte de fidélité.",
        ];
      case "has_reward":
        return [
          "Plus que quelques tampons et votre récompense est à vous !",
          card
            ? `Vous êtes proche de gagner ${card.reward_text}. Passez vite !`
            : "Vous êtes tout proche d'une récompense. Passez vite !",
          "🎁 Votre récompense vous tend les bras. Plus qu'un dernier passage.",
        ];
      case "birthdays":
        return [];
    }
  })();

  async function send() {
    if (!selectedCardId) {
      toast.error("Sélectionnez une carte");
      return;
    }
    if (!message.trim()) {
      toast.error("Saisissez un message");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCardId,
          message: message.trim(),
          segment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi");
      }
      const recipients: number = data.recipients ?? 0;
      const excluded: number = data.excluded ?? 0;
      if (recipients === 0 && excluded > 0) {
        // Cas limite : tous les clients ciblés sont en cooldown 12h.
        // On informe sans crier au succès.
        toast.error(
          `Aucune notif envoyée : ${excluded} client${excluded > 1 ? "s ont" : " a"} déjà reçu une annonce dans les 12 dernières heures.`,
        );
      } else {
        const base = `Campagne envoyée à ${recipients} client${recipients > 1 ? "s" : ""}`;
        const suffix =
          excluded > 0
            ? ` · ${excluded} exclu${excluded > 1 ? "s" : ""} (notif < 12h)`
            : "";
        toast.success(base + suffix);
      }
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${action.iconBg}`}
            >
              <action.icon className={`h-5 w-5 ${action.iconColor}`} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">
                {action.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cible : {action.count} client{action.count > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Choix carte (campagnes sont per-card côté API) */}
          {cards.length > 1 && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Carte concernée
              </label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                La campagne ne touchera que les clients de cette carte.
              </p>
            </div>
          )}

          {/* Templates */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Modèles de message
              </p>
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMessage(t)}
                    className="block w-full text-left text-xs text-foreground bg-beige hover:bg-beige-dark rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">
                Votre message
              </label>
              <span
                className={`text-[11px] ${
                  message.length > maxChars * 0.9
                    ? "text-amber-700"
                    : "text-muted-foreground"
                }`}
              >
                {message.length} / {maxChars}
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={maxChars}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, maxChars))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              placeholder="Cher client, ..."
            />
            <p className="text-[11px] text-muted-foreground">
              Limite 200 caractères. Le push apparaît dans Apple Wallet et
              Google Wallet du client.
            </p>
          </div>

          {/* Aperçu */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-md bg-yellow shrink-0 flex items-center justify-center">
              <span className="text-[11px] font-bold">a</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-foreground">
                aswallet · {card?.name ?? "Votre carte"}
              </p>
              <p className="text-xs text-foreground/80 mt-0.5 line-clamp-3">
                {message || "Votre message apparaîtra ici"}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              à l&apos;instant
            </span>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={sending}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={send}
            disabled={sending || !message.trim() || !selectedCardId}
            className="flex-[1.5]"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Envoyer maintenant
          </Button>
        </div>
      </div>
    </div>
  );
}
