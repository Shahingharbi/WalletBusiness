-- Onboarding state for businesses
-- Tracks the merchant's progression through the welcome wizard
-- and stores answers to the contextual questions (commerce type,
-- estimated clients, primary goal).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB;

-- Optional index to speed up the middleware redirect lookup.
CREATE INDEX IF NOT EXISTS idx_businesses_onboarding_completed_at
  ON businesses (onboarding_completed_at);

COMMENT ON COLUMN businesses.onboarding_data IS
  'JSON: { type: string, estimated_clients: string, goal: string }';
