import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Stamp, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScansChart } from "@/components/dashboard/scans-chart";

export default async function CardStatsPage({
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
    .select("id, name, business_id, design")
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .single();
  if (!card) notFound();

  // Get all card_instances for this card
  const { data: instances } = await supabase
    .from("card_instances")
    .select("id, total_stamps_ever, rewards_redeemed, created_at")
    .eq("card_id", id);

  const installs = instances?.length ?? 0;
  const totalStamps = (instances ?? []).reduce(
    (acc, i) => acc + (i.total_stamps_ever ?? 0),
    0
  );
  const totalRewards = (instances ?? []).reduce(
    (acc, i) => acc + (i.rewards_redeemed ?? 0),
    0
  );

  // Scans per day over last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const instanceIds = (instances ?? []).map((i) => i.id);
  let scansData: { created_at: string }[] = [];
  if (instanceIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select("created_at")
      .in("card_instance_id", instanceIds)
      .eq("type", "stamp_add")
      .gte("created_at", since.toISOString());
    scansData = data ?? [];
  }

  const buckets: { date: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const tx of scansData) {
    const day = new Date(tx.created_at).toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.date === day);
    if (bucket) bucket.count++;
  }

  const design = (card.design || {}) as { accent_color?: string };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/cards/${card.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-sm text-gray-500">{card.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Installations" value={installs} icon={Users} />
        <KpiCard title="Tampons distribués" value={totalStamps} icon={Stamp} />
        <KpiCard title="Récompenses utilisées" value={totalRewards} icon={Gift} />
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Scans des 30 derniers jours
          </h2>
          <ScansChart data={buckets} accent={design.accent_color || "#10b981"} />
        </CardContent>
      </Card>
    </div>
  );
}
