-- 011_merge_reward_fields.sql
--
-- Fusionne `reward_subtitle` dans `reward_text` côté UX : un seul champ
-- "Récompense / Offre" suffit à expliquer l'offre au porteur, et la double
-- saisie créait de la confusion ("quelle est la diff entre les deux ?").
--
-- Les valeurs `reward_subtitle` éventuellement stockées avant cette migration
-- ne sont PAS récupérées automatiquement (les merchants peuvent rééditer la
-- carte si besoin) — la colonne est simplement supprimée.
ALTER TABLE cards DROP COLUMN IF EXISTS reward_subtitle;
