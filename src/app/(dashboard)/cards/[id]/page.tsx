import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, ExternalLink, BarChart3, Users, Info } from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CARD_STATUSES } from "@/lib/constants";

import { CardPreviewServer } from "./card-preview-server";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{card.name}</h1>
          <Badge variant={statusVariant}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {card.status === "draft" && (
            <form action={`/api/cards/${card.id}/activate`} method="POST">
              <Button variant="default" type="submit">
                Activer
              </Button>
            </form>
          )}
          <Link href={`/cards/${card.id}/edit`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Card preview */}
        <div className="lg:w-[45%]">
          <CardPreviewServer card={card} design={design} />
        </div>

        {/* QR + info */}
        <div className="lg:w-[55%] space-y-6">
          {/* QR Code card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {qrDataUrl && (
                  <div className="shrink-0">
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      width={160}
                      height={160}
                      className="rounded-lg border border-gray-200"
                    />
                  </div>
                )}
                <div className="space-y-3 text-center sm:text-left">
                  <h3 className="font-semibold text-gray-900">
                    QR Code de la carte
                  </h3>
                  <p className="text-sm text-gray-500">
                    Partagez ce QR code pour que vos clients puissent installer
                    la carte sur leur telephone.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{cardPublicUrl}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="info">
            <TabsList>
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
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Type
                      </p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        Tampon
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
                        Recompense
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
                          ? "Illimitee"
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
                    Voir tous les clients qui ont installe cette carte.
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
                    Installations, scans et recompenses des 30 derniers jours.
                  </p>
                  <Link href={`/cards/${card.id}/stats`}>
                    <Button variant="secondary">Voir les stats</Button>
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
