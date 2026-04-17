"use client";

import { CardPreview } from "@/components/cards/card-preview";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";

interface CardPreviewServerProps {
  card: {
    name: string;
    stamp_count: number;
    reward_text: string;
    card_type?: CardType;
  };
  design: Record<string, unknown>;
}

export function CardPreviewServer({ card, design }: CardPreviewServerProps) {
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
      />
    </div>
  );
}
