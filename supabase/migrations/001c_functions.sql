-- PARTIE 3 : FONCTIONS
-- Copie-colle dans SQL Editor et clique Run

CREATE OR REPLACE FUNCTION generate_slug(input TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(translate(input, 'àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ', 'aaaeeeeiioouuycaaaeeeeiioouuyc'), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s]+', '-', 'g'));
END; $$;

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
    INSERT INTO businesses (owner_id, name, slug) VALUES (NEW.id, v_business_name, v_slug) RETURNING id INTO v_business_id;
  END IF;

  INSERT INTO profiles (id, role, business_id, first_name, last_name)
  VALUES (NEW.id, v_role, v_business_id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''));

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION add_stamp(p_card_instance_id UUID, p_scanned_by UUID, p_value INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
  v_card cards%ROWTYPE;
  v_reward_earned BOOLEAN := FALSE;
  v_new_stamps INTEGER;
BEGIN
  SELECT * INTO v_instance FROM card_instances WHERE id = p_card_instance_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Carte introuvable'); END IF;
  SELECT * INTO v_card FROM cards WHERE id = v_instance.card_id;
  IF v_instance.status != 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'Carte inactive'); END IF;

  v_new_stamps := v_instance.stamps_collected + p_value;

  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'stamp_add', p_value, p_scanned_by);

  IF v_new_stamps >= v_card.stamp_count THEN
    v_new_stamps := v_new_stamps - v_card.stamp_count;
    v_reward_earned := TRUE;
    UPDATE card_instances SET stamps_collected = v_new_stamps, total_stamps_ever = total_stamps_ever + p_value, rewards_available = rewards_available + 1, last_scanned_at = NOW() WHERE id = p_card_instance_id;
    INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by) VALUES (p_card_instance_id, v_instance.business_id, 'reward_earned', 1, p_scanned_by);
  ELSE
    UPDATE card_instances SET stamps_collected = v_new_stamps, total_stamps_ever = total_stamps_ever + p_value, last_scanned_at = NOW() WHERE id = p_card_instance_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'stamps_collected', v_new_stamps, 'stamps_total', v_card.stamp_count, 'rewards_available', v_instance.rewards_available + (CASE WHEN v_reward_earned THEN 1 ELSE 0 END), 'reward_earned', v_reward_earned, 'reward_text', v_card.reward_text);
END; $$;

CREATE OR REPLACE FUNCTION redeem_reward(p_card_instance_id UUID, p_scanned_by UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_instance card_instances%ROWTYPE;
BEGIN
  SELECT * INTO v_instance FROM card_instances WHERE id = p_card_instance_id FOR UPDATE;
  IF v_instance.rewards_available < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'Aucune recompense disponible'); END IF;
  UPDATE card_instances SET rewards_available = rewards_available - 1, rewards_redeemed = rewards_redeemed + 1 WHERE id = p_card_instance_id;
  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by) VALUES (p_card_instance_id, v_instance.business_id, 'reward_redeemed', 1, p_scanned_by);
  RETURN jsonb_build_object('success', true, 'rewards_remaining', v_instance.rewards_available - 1);
END; $$;
