-- Campagnes : push messages aux porteurs de carte (Boomerangme "broadcasts").
-- Une campagne = un message envoyé aux instances d'une carte filtré par segment.

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('all', 'inactive_30d', 'has_reward', 'never_redeemed')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX campaigns_card_sent_idx ON campaigns (card_id, sent_at DESC);
CREATE INDEX campaigns_business_idx ON campaigns (business_id, sent_at DESC);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns: business owners read their own"
  ON campaigns FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "campaigns: business owners insert their own"
  ON campaigns FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));
