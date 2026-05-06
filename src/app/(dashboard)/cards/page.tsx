import Link from "next/link";
import { Plus, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user!.id)
    .single();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, name, status, card_type, max_stamps:stamp_count, reward_text")
    .eq("business_id", profile!.business_id)
    .order("created_at", { ascending: false });

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "draft":
        return "secondary" as const;
      case "archived":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "draft":
        return "Brouillon";
      case "archived":
        return "Archivée";
      default:
        return status;
    }
  };

  // Sous-titre adapté au type de carte. Avant on affichait "X tampons" pour
  // tous les types y compris Cashback (visites), Discount (avantage permanent)
  // et Membership (carte de membre). Le label métier ne correspondait pas.
  const subtitleFor = (card: {
    card_type: string | null;
    max_stamps: number;
    reward_text: string | null;
  }) => {
    switch (card.card_type) {
      case "cashback":
        return `${card.max_stamps} visites avant cashback`;
      case "discount":
        return card.reward_text || "Remise permanente";
      case "membership":
        return card.reward_text || "Adhésion";
      case "stamp":
      default:
        return `${card.max_stamps} tampons`;
    }
  };

  const typeBadge = (type: string | null) => {
    switch (type) {
      case "cashback":
        return { label: "Cashback", color: "bg-blue-50 text-blue-700" };
      case "discount":
        return { label: "Remise", color: "bg-purple-50 text-purple-700" };
      case "membership":
        return { label: "Adhésion", color: "bg-amber-50 text-amber-700" };
      case "stamp":
      default:
        return { label: "Tampon", color: "bg-emerald-50 text-emerald-700" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Mes cartes</h1>
        <Link href="/cards/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle carte
          </Button>
        </Link>
      </div>

      {/* Content */}
      {!cards || cards.length === 0 ? (
        <Card className="border-beige-dark">
          <CardContent className="py-14 sm:py-20 px-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-beige flex items-center justify-center mb-6">
              <CreditCard className="h-16 w-16 text-foreground/70" strokeWidth={1.4} />
            </div>
            <h2
              className="text-xl sm:text-2xl text-foreground"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Créez votre première carte
            </h2>
            <p
              className="mt-3 text-sm sm:text-base text-foreground/70 max-w-md mx-auto"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Vos clients pourront l&apos;ajouter à leur Wallet en 2 clics.
              5 minutes suffisent.
            </p>
            <div className="mt-6">
              <Link href="/cards/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une carte
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const tBadge = typeBadge(card.card_type);
            return (
              <Link key={card.id} href={`/cards/${card.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {card.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${tBadge.color}`}
                          >
                            {tBadge.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {subtitleFor(card)}
                        </p>
                      </div>
                      <Badge variant={statusVariant(card.status)}>
                        {statusLabel(card.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
