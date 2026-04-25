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
    .select("id, name, status, max_stamps:stamp_count")
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
          {cards.map((card) => (
            <Link key={card.id} href={`/cards/${card.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">
                        {card.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {card.max_stamps} tampons
                      </p>
                    </div>
                    <Badge variant={statusVariant(card.status)}>
                      {statusLabel(card.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
