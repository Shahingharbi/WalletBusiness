-- 008_card_reward_subtitle.sql
--
-- Adds an optional `reward_subtitle` to cards. When set, this short phrase
-- replaces the auto-computed "X tampons" line in the wallet auxiliary fields
-- (Apple) and is added as a "Notre offre" module (Google).
--
-- Example: "12 tampons = 1 sandwich offert" — gives the customer the offer
-- at a glance without having to read the back of the pass.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS reward_subtitle TEXT;
