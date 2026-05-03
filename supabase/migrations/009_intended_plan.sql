-- 009_intended_plan.sql
--
-- Adds two columns capturing the plan + billing interval the merchant chose
-- on the public pricing page BEFORE actually subscribing. Used to:
--   1. Pre-fill the Stripe Checkout amount in the trial banner CTA.
--   2. Show "Vous avez choisi le plan Pro" on the dashboard pre-conversion.
--
-- Both columns are nullable: legacy accounts and Google OAuth signups
-- without a ?plan= query param simply have NULL until first checkout.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS intended_plan TEXT,
  ADD COLUMN IF NOT EXISTS intended_interval TEXT;
