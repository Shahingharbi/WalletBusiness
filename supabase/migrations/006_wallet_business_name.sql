-- 006_wallet_business_name.sql
-- Adds an optional `wallet_business_name` column to `cards` so a merchant
-- can choose a custom display name for the wallet card top-left (logoText
-- on Apple, issuerName on Google) without changing their internal business
-- name. NULL = fallback to businesses.name (current behavior).

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS wallet_business_name TEXT;

COMMENT ON COLUMN cards.wallet_business_name IS
  'Nom affiché dans le wallet (top-left). NULL = utiliser businesses.name.';
