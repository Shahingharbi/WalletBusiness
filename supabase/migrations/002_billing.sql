-- PARTIE BILLING : abonnements Stripe
-- Copie-colle dans SQL Editor et clique Run

-- Colonnes d'abonnement sur la table businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_interval TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Index pour lookup webhook (Stripe -> business)
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer_id
  ON businesses(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_businesses_stripe_subscription_id
  ON businesses(stripe_subscription_id);

-- Initialiser un essai de 14 jours pour tous les commerces existants qui n'en
-- ont pas encore un (idempotent).
UPDATE businesses
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL;

-- Mettre à jour le trigger handle_new_user pour activer l'essai à la création
-- d'un compte business_owner.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business_id UUID;
  v_business_name TEXT;
  v_slug TEXT;
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'business_owner');
  v_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Commerce');
  v_slug := generate_slug(v_business_name) || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);

  IF v_role = 'business_owner' THEN
    INSERT INTO businesses (owner_id, name, slug, trial_ends_at)
    VALUES (NEW.id, v_business_name, v_slug, NOW() + INTERVAL '14 days')
    RETURNING id INTO v_business_id;
  END IF;

  INSERT INTO profiles (id, role, business_id, first_name, last_name)
  VALUES (NEW.id, v_role, v_business_id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''));

  RETURN NEW;
END; $$;

-- Table de dédoublonnage des événements Stripe (idempotence webhook)
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pas de RLS sur stripe_events : seul le service role (webhook) y écrit.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
