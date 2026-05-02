import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditCardForm } from "./edit-form";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

export default async function EditCardPage({
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
    .select("business_id, role")
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

  const design = { ...DEFAULT_CARD_DESIGN, ...(card.design || {}) };

  return (
    <EditCardForm
      cardId={card.id}
      cardType={card.card_type}
      businessName={business?.name ?? ""}
      initialSettings={{
        name: card.name,
        stampCount: card.stamp_count,
        rewardText: card.reward_text,
        barcodeType: card.barcode_type,
        expirationType: card.expiration_type,
        expirationDate: card.expiration_date
          ? new Date(card.expiration_date).toISOString().slice(0, 10)
          : "",
        expirationDays: card.expiration_days ?? 30,
        walletBusinessName: card.wallet_business_name ?? "",
      }}
      initialDesign={design}
      status={card.status}
    />
  );
}
