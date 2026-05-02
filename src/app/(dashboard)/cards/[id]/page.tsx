import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, BarChart3, Users, Info, Send, ExternalLink, Sparkles, Zap } from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CARD_STATUSES, CARD_TYPES } from "@/lib/constants";

import { CardPreviewServer } from "./card-preview-server";
import { ShareCard } from "./share-card";
import { ActivateButton } from "./activate-button";

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const justCreated = sp.created === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();

  if (!profile) notFound();

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .single();

  if (!card) notFound();

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", profile.business_id)
    .single();
  const businessName = business?.name ?? "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cardPublicUrl = `${appUrl}/c/${card.id}`;

  // Generate QR code as data URL
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(cardPublicUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    // QR generation failed silently
  }

  const status = CARD_STATUSES[card.status as keyof typeof CARD_STATUSES] || CARD_STATUSES.draft;
  const statusVariant =
    card.status === "active"
      ? ("success" as const)
      : card.status === "archived"
        ? ("destructive" as const)
        : card.status === "paused"
          ? ("warning" as const)
          : ("secondary" as const);

  const design = card.design || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{card.name}</h1>
          <Badge variant={statusVariant}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {card.status === "draft" && <ActivateButton cardId={card.id} />}
          <a
            href={cardPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            Voir comme un client
          </a>
          <Link href={`/cards/${card.id}/edit`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </Link>
        </div>
      </div>

      {justCreated && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
              <Sparkles className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900">
                  Carte créée avec succès
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Testez l&apos;expérience client puis activez la carte pour la rendre disponible.
                </p>
              </div>
            </div>
            <a
              href={cardPublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
              Tester ma carte
            </a>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Card preview */}
        <div className="lg:w-[45%] flex justify-center lg:block">
          <CardPreviewServer card={card} design={design} businessName={businessName} />
        </div>

        {/* QR + info */}
        <div className="lg:w-[55%] space-y-6 min-w-0">
          <ShareCard
            qrDataUrl={qrDataUrl}
            cardPublicUrl={cardPublicUrl}
            cardName={card.name}
          />

          {/* Tabs */}
          <Tabs defaultValue="info">
            <TabsList className="w-full sm:w-auto overflow-x-auto max-w-full">
              <TabsTrigger value="info">
                <Info className="h-4 w-4 mr-1.5" />
                Info
              </TabsTrigger>
              <TabsTrigger value="clients">
                <Users className="h-4 w-4 mr-1.5" />
                Clients
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="campaigns">
                <Send className="h-4 w-4 mr-1.5" />
                Campagnes
              </TabsTrigger>
              <TabsTrigger value="auto-push">
                <Zap className="h-4 w-4 mr-1.5" />
                Auto-push
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Type
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {CARD_TYPES[card.card_type as keyof typeof CARD_TYPES]?.label ?? "Tampon"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Tampons
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {card.stamp_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Récompense
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {card.reward_text}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Code-barres
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {card.barcode_type === "qr" ? "QR Code" : "PDF 417"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Expiration
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {card.expiration_type === "unlimited"
                          ? "Illimitée"
                          : card.expiration_type === "fixed_date"
                            ? card.expiration_date
                            : `${card.expiration_days} jours`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clients">
              <Card>
                <CardContent className="p-6 text-center py-10 space-y-3">
                  <Users className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">
                    Voir tous les clients qui ont installé cette carte.
                  </p>
                  <Link href={`/cards/${card.id}/clients`}>
                    <Button variant="secondary">Ouvrir la liste</Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card>
                <CardContent className="p-6 text-center py-10 space-y-3">
                  <BarChart3 className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">
                    Installations, scans et récompenses des 30 derniers jours.
                  </p>
                  <Link href={`/cards/${card.id}/stats`}>
                    <Button variant="secondary">Voir les stats</Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns">
              <Card>
                <CardContent className="p-6 text-center py-10 space-y-3">
                  <Send className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">
                    Envoyez un message push wallet à tous vos clients ou à un
                    segment ciblé.
                  </p>
                  <Link href={`/cards/${card.id}/campaigns`}>
                    <Button variant="secondary">Ouvrir les campagnes</Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto-push">
              <Card>
                <CardContent className="p-6 text-center py-10 space-y-3">
                  <Zap className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500">
                    Notifications automatiques : inactivité 30 j, 80 % de la
                    récompense, anniversaire client.
                  </p>
                  <Link href={`/cards/${card.id}/auto-push`}>
                    <Button variant="secondary">Configurer</Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
