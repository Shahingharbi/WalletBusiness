"use client";

import { CardPreview } from "@/components/cards/card-preview";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";

interface CardPreviewServerProps {
  card: {
    name: string;
    stamp_count: number;
    reward_text: string;
    card_type?: CardType;
    barcode_type?: "qr" | "pdf417";
    wallet_business_name?: string | null;
  };
  design: Record<string, unknown>;
  businessName?: string;
}

export function CardPreviewServer({ card, design, businessName }: CardPreviewServerProps) {
  const mergedDesign = {
    ...DEFAULT_CARD_DESIGN,
    ...design,
  } as typeof DEFAULT_CARD_DESIGN;

  return (
    <div className="sticky top-6">
      <CardPreview
        cardName={card.name}
        stampCount={card.stamp_count}
        rewardText={card.reward_text}
        collectedStamps={0}
        design={mergedDesign}
        cardType={card.card_type ?? "stamp"}
        barcodeType={card.barcode_type ?? "qr"}
        businessName={businessName}
        walletBusinessName={card.wallet_business_name ?? null}
      />
    </div>
  );
}
