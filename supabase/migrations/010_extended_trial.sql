-- 010_extended_trial.sql
--
-- Pricing relaunch (mai 2026) : trial bumpé de 14 jours à 30 jours.
--
-- 1. Nouveau handle_new_user :
--    - trial 30 jours
--    - random suffix via md5() au lieu de pgcrypto.gen_random_bytes()
--      (pgcrypto vit désormais dans le schema `extensions/` côté Supabase
--      managed, ce qui faisait planter le trigger SECURITY DEFINER en
--      "function gen_random_bytes(integer) does not exist").
--    - récupère intended_plan / intended_interval depuis user_metadata
--      (mis par /api/account/intended-plan après signup) et les pré-remplit
--      sur businesses pour que le banner trial puisse pointer sur le bon
--      checkout Stripe sans ré-interroger l'utilisateur.
-- 2. Trials encore en cours : étendus de 16 jours (30 - 14) sauf si le
--    merchant est déjà en active.
--
-- Appliquée le 2026-05-03 via Supabase Management API.
-- Vérification: 11 lignes étendues lors du run initial.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_business_id UUID;
  v_business_name TEXT;
  v_slug TEXT;
  v_role TEXT;
  v_intended_plan TEXT;
  v_intended_interval TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'business_owner');
  v_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Commerce');
  v_intended_plan := NEW.raw_user_meta_data->>'intended_plan';
  v_intended_interval := NEW.raw_user_meta_data->>'intended_interval';
  v_slug := generate_slug(v_business_name) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

  IF v_role = 'business_owner' THEN
    INSERT INTO businesses (owner_id, name, slug, trial_ends_at, intended_plan, intended_interval)
    VALUES (NEW.id, v_business_name, v_slug, NOW() + INTERVAL '30 days', v_intended_plan, v_intended_interval)
    RETURNING id INTO v_business_id;
  END IF;

  INSERT INTO profiles (id, role, business_id, first_name, last_name)
  VALUES (NEW.id, v_role, v_business_id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''));

  RETURN NEW;
END; $$;

-- Best-effort : étend les trials encore en cours.
UPDATE businesses
SET trial_ends_at = trial_ends_at + INTERVAL '16 days'
WHERE trial_ends_at > NOW()
  AND (subscription_status IS NULL OR subscription_status NOT IN ('active'));
