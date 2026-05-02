-- Migration 007 : geo-push (locations) + RFM segmentation + auto-push.
--
-- The `locations` table already exists from migration 001 — this migration:
--  1. Adds `relevant_text` (Apple PassKit & Google Wallet pass-embedded text
--     shown on the lockscreen when the user is near the location).
--  2. Adds full UPDATE / DELETE / ALL RLS policies (only SELECT + INSERT
--     existed previously).
--  3. Adds `clients.birthday` (DATE) for the birthday auto-push.
--  4. Adds `cards.auto_push_settings` (JSONB) for the per-card auto-push
--     toggles + custom messages.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS relevant_text TEXT;

-- Drop the old INSERT-only policy and replace by a single ALL policy
-- (covers INSERT/UPDATE/DELETE) plus the existing SELECT.
DROP POLICY IF EXISTS locations_insert ON locations;
DROP POLICY IF EXISTS locations_update ON locations;
DROP POLICY IF EXISTS locations_delete ON locations;
DROP POLICY IF EXISTS locations_all ON locations;

CREATE POLICY locations_all ON locations
  FOR ALL
  TO authenticated
  USING (is_super_admin() OR business_id = get_user_business_id())
  WITH CHECK (is_super_admin() OR business_id = get_user_business_id());

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS birthday DATE;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS auto_push_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Track which automated pushes have been sent so the cron is idempotent
-- across firings (one inactive_30d push every 30 days, one near-reward
-- push per week, one birthday push per year).
CREATE TABLE IF NOT EXISTS auto_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('inactive_30d', 'near_reward_80', 'birthday')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auto_push_log_instance_idx ON auto_push_log (card_instance_id, trigger, sent_at DESC);
CREATE INDEX IF NOT EXISTS auto_push_log_business_idx ON auto_push_log (business_id, sent_at DESC);

ALTER TABLE auto_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_push_log_select ON auto_push_log;
CREATE POLICY auto_push_log_select ON auto_push_log
  FOR SELECT
  TO authenticated
  USING (is_super_admin() OR business_id = get_user_business_id());
