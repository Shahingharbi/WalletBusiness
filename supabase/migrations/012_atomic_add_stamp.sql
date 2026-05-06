-- Migration 012 : add_stamp atomique avec dedup intégrée
--
-- Bug audit : la dedup 60s était dans /api/scan/route.ts EN AMONT du
-- RPC add_stamp. Deux caissiers (ou un caissier qui double-clique) qui
-- scannent la même carte simultanément passent tous deux le check (les
-- deux voient `recentScan = null` au même instant), puis le RPC s'exécute
-- 2 fois → le client gagne 2 tampons au lieu d'1.
--
-- Fix : on déplace la dedup DANS la RPC SQL avec un `pg_advisory_xact_lock`
-- + check `EXISTS` sur les transactions récentes. Le `SELECT ... FOR UPDATE`
-- existant + cette dedup atomique éliminent toute fenêtre de course.
--
-- Comportement :
--   - 1ère requête prend le verrou, fait le check (pas de tx récente),
--     incrémente, libère le verrou.
--   - 2e requête concurrente attend le verrou, puis trouve la tx récente
--     (juste créée) → retourne `error: 'rate_limit'`.
--
-- Fenêtre de dedup : 30 secondes (au lieu des 60s côté API). 30s suffit
-- pour absorber un double-clic + clic-fantôme touchscreen sans bloquer
-- le caissier qui scanne 2 cartes différentes successivement.

CREATE OR REPLACE FUNCTION add_stamp(p_card_instance_id UUID, p_scanned_by UUID, p_value INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
  v_card cards%ROWTYPE;
  v_reward_earned BOOLEAN := FALSE;
  v_new_stamps INTEGER;
  v_recent_count INTEGER;
BEGIN
  -- Verrou exclusif basé sur l'UUID de la card_instance. Sérialise tous
  -- les add_stamp concurrents sur la même carte sans bloquer les autres.
  PERFORM pg_advisory_xact_lock(hashtext(p_card_instance_id::text));

  SELECT * INTO v_instance FROM card_instances WHERE id = p_card_instance_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Carte introuvable'); END IF;

  IF v_instance.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carte inactive');
  END IF;

  -- Dedup atomique : refuse un add_stamp si un autre vient d'avoir lieu
  -- dans les 30 dernières secondes. Le verrou ci-dessus garantit qu'on
  -- ne lit pas une vue stale.
  SELECT COUNT(*) INTO v_recent_count
  FROM transactions
  WHERE card_instance_id = p_card_instance_id
    AND type = 'stamp_add'
    AND created_at >= NOW() - INTERVAL '30 seconds';

  IF v_recent_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un tampon vient déjà d''être ajouté pour ce client. Patientez 30 secondes.'
    );
  END IF;

  SELECT * INTO v_card FROM cards WHERE id = v_instance.card_id;

  v_new_stamps := v_instance.stamps_collected + p_value;

  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'stamp_add', p_value, p_scanned_by);

  IF v_new_stamps >= v_card.stamp_count THEN
    v_new_stamps := v_new_stamps - v_card.stamp_count;
    v_reward_earned := TRUE;
    UPDATE card_instances
    SET stamps_collected = v_new_stamps,
        total_stamps_ever = total_stamps_ever + p_value,
        rewards_available = rewards_available + 1,
        last_scanned_at = NOW()
    WHERE id = p_card_instance_id;
    INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
    VALUES (p_card_instance_id, v_instance.business_id, 'reward_earned', 1, p_scanned_by);
  ELSE
    UPDATE card_instances
    SET stamps_collected = v_new_stamps,
        total_stamps_ever = total_stamps_ever + p_value,
        last_scanned_at = NOW()
    WHERE id = p_card_instance_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stamps_collected', v_new_stamps,
    'stamps_total', v_card.stamp_count,
    'rewards_available', v_instance.rewards_available + (CASE WHEN v_reward_earned THEN 1 ELSE 0 END),
    'reward_earned', v_reward_earned,
    'reward_text', v_card.reward_text
  );
END; $$;
