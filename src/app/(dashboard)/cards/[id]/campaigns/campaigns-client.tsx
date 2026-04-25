"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, Users, Clock, Gift, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Segment = "all" | "inactive_30d" | "has_reward" | "never_redeemed";

export interface CampaignRow {
  id: string;
  message: string;
  segment: Segment;
  recipients_count: number;
  sent_at: string;
}

interface SegmentCounts {
  all: number;
  inactive_30d: number;
  has_reward: number;
  never_redeemed: number;
}

const SEGMENTS: Array<{
  key: Segment;
  label: string;
  description: string;
  Icon: typeof Users;
}> = [
  {
    key: "all",
    label: "Tous",
    description: "Tous les porteurs actifs",
    Icon: Users,
  },
  {
    key: "inactive_30d",
    label: "Inactifs 30j+",
    description: "Pas scanné depuis 30 jours",
    Icon: Clock,
  },
  {
    key: "has_reward",
    label: "Récompense dispo",
    description: "Une récompense en attente",
    Icon: Gift,
  },
  {
    key: "never_redeemed",
    label: "Jamais utilisée",
    description: "Aucune récompense réclamée",
    Icon: Sparkles,
  },
];

const MAX_LENGTH = 200;

function segmentLabel(s: Segment): string {
  return SEGMENTS.find((x) => x.key === s)?.label ?? s;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `Il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface CampaignsClientProps {
  cardId: string;
  initialCampaigns: CampaignRow[];
}

export function CampaignsClient({
  cardId,
  initialCampaigns,
}: CampaignsClientProps) {
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<
    | { type: "success"; text: string }
    | { type: "error"; text: string }
    | null
  >(null);

  // Charge les compteurs de segment
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/segment-counts?cardId=${cardId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.counts) setCounts(d.counts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const remaining = MAX_LENGTH - message.length;
  const targetCount = counts ? counts[segment] : null;
  const canSend =
    message.trim().length > 0 &&
    message.length <= MAX_LENGTH &&
    !sending &&
    (targetCount === null || targetCount > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          message: message.trim(),
          segment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data?.error ?? "Erreur lors de l'envoi",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Campagne envoyée à ${data.recipients} porteur${
            data.recipients > 1 ? "s" : ""
          }.`,
        });
        setCampaigns((prev) => [
          {
            id: data.id,
            message: message.trim(),
            segment,
            recipients_count: data.recipients,
            sent_at: data.sent_at ?? new Date().toISOString(),
          },
          ...prev,
        ]);
        setMessage("");
      }
    } catch {
      setFeedback({ type: "error", text: "Erreur réseau" });
    } finally {
      setSending(false);
    }
  };

  const histogramRows = useMemo(() => {
    return SEGMENTS.map((s) => ({
      ...s,
      count: counts ? counts[s.key] : null,
      isSelected: segment === s.key,
    }));
  }, [counts, segment]);

  return (
    <div className="space-y-6">
      {/* Histogramme par segment */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {histogramRows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => setSegment(row.key)}
            className={cn(
              "rounded-lg border-2 p-4 text-left transition-all cursor-pointer",
              row.isSelected
                ? "border-foreground bg-yellow/30 shadow-sm"
                : "border-beige-dark bg-white hover:border-foreground/40"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <row.Icon className="h-4 w-4 text-foreground/70" />
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                {row.label}
              </span>
            </div>
            <p
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-ginto-nord)" }}
            >
              {row.count === null ? "—" : row.count}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {row.description}
            </p>
          </button>
        ))}
      </div>

      {/* Composer */}
      <Card className="border-beige-dark">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="campaign-message"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Votre message
              </label>
              <textarea
                id="campaign-message"
                rows={3}
                maxLength={MAX_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex : 10% de remise mardi 17h-19h sur tous les menus !"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-muted-foreground">
                  S&apos;affiche dans le wallet du client avec une notification push
                  (Google Wallet) ou en back-of-card (Apple Wallet).
                </p>
                <span
                  className={cn(
                    "text-xs font-mono shrink-0 ml-3",
                    remaining < 20
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  )}
                >
                  {remaining}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-sm text-foreground/70">
                Cible :{" "}
                <span className="font-semibold text-foreground">
                  {segmentLabel(segment)}
                </span>{" "}
                {targetCount !== null && (
                  <>
                    &middot;{" "}
                    <span className="font-semibold text-foreground">
                      {targetCount}
                    </span>{" "}
                    destinataire{targetCount > 1 ? "s" : ""}
                  </>
                )}
              </p>
              <Button
                type="submit"
                disabled={!canSend}
                loading={sending}
                className="w-full sm:w-auto"
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer maintenant
              </Button>
            </div>

            {feedback && (
              <div
                role="alert"
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                )}
              >
                {feedback.text}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Historique */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-foreground/60" />
          <h2
            className="text-sm font-semibold text-foreground uppercase tracking-wider"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Historique
          </h2>
        </div>
        {campaigns.length === 0 ? (
          <Card className="border-beige-dark">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune campagne envoyée pour le moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <Card key={c.id} className="border-beige-dark">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground line-clamp-2">
                      {c.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium">
                        {segmentLabel(c.segment)}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {c.recipients_count} destinataire
                        {c.recipients_count > 1 ? "s" : ""}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatRelative(c.sent_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
