import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, CreditCard, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AdminCreateAccountForm } from "@/components/admin/create-account-form";
import { AdminPromoteForm } from "@/components/admin/promote-form";

interface AdminPageProps {
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  // Auth + super_admin gate côté server.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Pagination businesses (via service role pour bypasser RLS).
  const admin = createAdminClient();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const {
    data: businesses,
    count: businessesCount,
  } = await admin
    .from("businesses")
    .select(
      "id, name, owner_id, subscription_status, subscription_plan, trial_ends_at, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // Fetch owner emails + cards/clients counts en parallèle.
  const enriched = await Promise.all(
    (businesses ?? []).map(async (b) => {
      const [ownerRes, cardsRes, clientsRes] = await Promise.all([
        admin.auth.admin.getUserById(b.owner_id),
        admin
          .from("cards")
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id),
        admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id),
      ]);
      return {
        ...b,
        ownerEmail: ownerRes.data?.user?.email ?? "—",
        cardsCount: cardsRes.count ?? 0,
        clientsCount: clientsRes.count ?? 0,
      };
    })
  );

  // Stats globales en parallèle.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    merchantsRes,
    activeCardsRes,
    clientsRes,
    txMonthRes,
  ] = await Promise.all([
    admin.from("businesses").select("id", { count: "exact", head: true }),
    admin
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin.from("clients").select("id", { count: "exact", head: true }),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil((businessesCount ?? 0) / PAGE_SIZE)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-yellow flex items-center justify-center">
          <Shield className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h1
            className="text-2xl sm:text-3xl text-foreground"
            style={{
              fontFamily: "var(--font-ginto-nord)",
              fontWeight: 500,
            }}
          >
            Administration aswallet
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion plateforme — réservé aux super administrateurs.
          </p>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Commerçants"
          value={merchantsRes.count ?? 0}
          icon={Users}
        />
        <StatCard
          label="Cartes actives"
          value={activeCardsRes.count ?? 0}
          icon={CreditCard}
        />
        <StatCard
          label="Clients (total)"
          value={clientsRes.count ?? 0}
          icon={Users}
        />
        <StatCard
          label="Transactions ce mois"
          value={txMonthRes.count ?? 0}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-beige-dark">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Créer un compte test illimité
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Génère un commerçant avec abonnement Business actif jusqu&apos;en
                2126. Idéal pour démonstrations.
              </p>
            </div>
            <AdminCreateAccountForm />
          </CardContent>
        </Card>

        <Card className="border-beige-dark">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Promouvoir en super_admin
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Donne à un compte existant l&apos;accès à cette page admin.
              </p>
            </div>
            <AdminPromoteForm />
          </CardContent>
        </Card>
      </div>

      {/* Tableau commerçants */}
      <Card className="border-beige-dark">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-lg font-semibold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Comptes commerçants
            </h2>
            <span className="text-xs text-muted-foreground">
              {businessesCount ?? 0} au total — page {page} / {totalPages}
            </span>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-beige-dark">
                  <th className="py-2 pr-3">Id</th>
                  <th className="py-2 pr-3">Commerce</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Essai</th>
                  <th className="py-2 pr-3 text-right">Cartes</th>
                  <th className="py-2 pr-3 text-right">Clients</th>
                  <th className="py-2 pr-3">Inscrit</th>
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Aucun commerçant pour le moment.
                    </td>
                  </tr>
                ) : (
                  enriched.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-beige-dark/40 last:border-b-0"
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                        {b.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {b.name ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {b.ownerEmail}
                      </td>
                      <td className="py-2.5 pr-3 capitalize">
                        {b.subscription_plan ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <SubscriptionBadge
                          status={b.subscription_status ?? null}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {b.trial_ends_at
                          ? new Date(b.trial_ends_at).toLocaleDateString(
                              "fr-FR"
                            )
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono">
                        {b.cardsCount}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono">
                        {b.clientsCount}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <Link
                href={`/admin?page=${Math.max(1, page - 1)}`}
                className={`text-sm font-semibold ${
                  page <= 1
                    ? "pointer-events-none opacity-40"
                    : "text-foreground hover:underline"
                }`}
              >
                ← Précédent
              </Link>
              <span className="text-xs text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Link
                href={`/admin?page=${Math.min(totalPages, page + 1)}`}
                className={`text-sm font-semibold ${
                  page >= totalPages
                    ? "pointer-events-none opacity-40"
                    : "text-foreground hover:underline"
                }`}
              >
                Suivant →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
}) {
  return (
    <Card className="border-beige-dark">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-yellow/40 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            {value.toLocaleString("fr-FR")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionBadge({ status }: { status: string | null }) {
  if (status === "active") return <Badge variant="success">Actif</Badge>;
  if (status === "trialing")
    return <Badge variant="default">Essai</Badge>;
  if (status === "past_due")
    return <Badge variant="destructive">Impayé</Badge>;
  if (status === "canceled" || status === "incomplete_expired")
    return <Badge variant="destructive">Annulé</Badge>;
  return <Badge variant="default">{status ?? "—"}</Badge>;
}
