-- Migration 014 : demande d'avis Google automatique après passage
--
-- Quelques minutes après un scan (add_stamp → last_scanned_at), le cron
-- `/api/cron/review-requests` envoie au client une notification wallet
-- avec le lien vers la fiche Google du commerce. Réglages par carte dans
-- `cards.auto_push_settings.google_review` (JSONB existant, migration 007).
--
-- 1. Autorise le nouveau trigger `google_review` dans `auto_push_log`.
-- 2. Index unique partiel : UNE seule demande d'avis par client et par
--    carte, même si deux exécutions du cron se chevauchent (le cron insère
--    le log AVANT d'envoyer et saute le client si l'insert échoue).

ALTER TABLE auto_push_log DROP CONSTRAINT IF EXISTS auto_push_log_trigger_check;
ALTER TABLE auto_push_log
  ADD CONSTRAINT auto_push_log_trigger_check
  CHECK (trigger IN ('inactive_30d', 'near_reward_80', 'birthday', 'google_review'));

CREATE UNIQUE INDEX IF NOT EXISTS auto_push_log_google_review_once
  ON auto_push_log (card_instance_id)
  WHERE trigger = 'google_review';
