-- ============================================
-- ASWALLET (ex-FIDPASS) - SCHEMA INITIAL
-- A executer dans le SQL Editor de Supabase
-- ============================================

-- 1. TABLE: businesses
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'France',
  phone TEXT,
  category TEXT,
  timezone TEXT DEFAULT 'Europe/Paris',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);

-- 2. TABLE: profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'business_owner' CHECK (role IN ('super_admin', 'business_owner', 'employee')),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_business_id ON profiles(business_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 3. TABLE: cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'stamp' CHECK (card_type IN ('stamp', 'reward', 'membership', 'discount', 'cashback', 'coupon', 'gift', 'multipass')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  barcode_type TEXT NOT NULL DEFAULT 'qr' CHECK (barcode_type IN ('qr', 'pdf417')),
  stamp_count INTEGER NOT NULL DEFAULT 8 CHECK (stamp_count >= 1 AND stamp_count <= 30),
  reward_text TEXT NOT NULL DEFAULT 'Un repas offert !',
  reward_type TEXT DEFAULT 'free_item',
  expiration_type TEXT NOT NULL DEFAULT 'unlimited' CHECK (expiration_type IN ('unlimited', 'fixed_date', 'days_after_install')),
  expiration_date TIMESTAMPTZ,
  expiration_days INTEGER,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_business_id ON cards(business_id);
CREATE INDEX idx_cards_status ON cards(status);

-- 4. TABLE: clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);

-- 5. TABLE: card_instances
CREATE TABLE card_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stamps_collected INTEGER NOT NULL DEFAULT 0 CHECK (stamps_collected >= 0),
  rewards_available INTEGER NOT NULL DEFAULT 0 CHECK (rewards_available >= 0),
  rewards_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (rewards_redeemed >= 0),
  total_stamps_ever INTEGER NOT NULL DEFAULT 0 CHECK (total_stamps_ever >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  wallet_type TEXT CHECK (wallet_type IN ('apple', 'google', 'pwa', 'none')),
  installed_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_id, client_id)
);

CREATE INDEX idx_card_instances_card_id ON card_instances(card_id);
CREATE INDEX idx_card_instances_client_id ON card_instances(client_id);
CREATE INDEX idx_card_instances_business_id ON card_instances(business_id);
CREATE INDEX idx_card_instances_token ON card_instances(token);

-- 6. TABLE: transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stamp_add', 'stamp_remove', 'reward_earned', 'reward_redeemed', 'card_installed', 'card_expired', 'card_revoked')),
  value INTEGER DEFAULT 1,
  scanned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_card_instance_id ON transactions(card_instance_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- 7. TABLE: invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_business_id ON invitations(business_id);
CREATE INDEX idx_invitations_token ON invitations(token);

-- 8. TABLE: locations (prevu V2)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_business_id ON locations(business_id);

-- ============================================
-- FONCTIONS
-- ============================================

-- Fonction: updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_card_instances_updated_at BEFORE UPDATE ON card_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fonction: slug URL-friendly
CREATE OR REPLACE FUNCTION generate_slug(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        translate(input, 'àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ', 'aaaeeeeiioouuycaaaeeeeiioouuyc'),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '[\s]+', '-', 'g'
    )
  );
END;
$$;

-- Fonction: creation auto du profil + business a l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_business_name TEXT;
  v_slug TEXT;
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'business_owner');
  v_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Commerce');

  -- Generer un slug unique
  v_slug := generate_slug(v_business_name);
  -- Ajouter un suffixe aleatoire pour eviter les doublons
  v_slug := v_slug || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);

  -- Creer le business si c'est un business_owner
  IF v_role = 'business_owner' THEN
    INSERT INTO businesses (owner_id, name, slug)
    VALUES (NEW.id, v_business_name, v_slug)
    RETURNING id INTO v_business_id;
  END IF;

  -- Creer le profil
  INSERT INTO profiles (id, role, business_id, first_name, last_name)
  VALUES (
    NEW.id,
    v_role,
    v_business_id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Fonction: ajouter un tampon
CREATE OR REPLACE FUNCTION add_stamp(
  p_card_instance_id UUID,
  p_scanned_by UUID,
  p_value INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
  v_card cards%ROWTYPE;
  v_reward_earned BOOLEAN := FALSE;
  v_new_stamps INTEGER;
BEGIN
  SELECT * INTO v_instance FROM card_instances WHERE id = p_card_instance_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carte introuvable');
  END IF;

  SELECT * INTO v_card FROM cards WHERE id = v_instance.card_id;

  IF v_instance.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carte inactive');
  END IF;

  v_new_stamps := v_instance.stamps_collected + p_value;

  -- Log la transaction tampon
  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'stamp_add', p_value, p_scanned_by);

  -- Verifier si recompense atteinte
  IF v_new_stamps >= v_card.stamp_count THEN
    v_new_stamps := v_new_stamps - v_card.stamp_count;
    v_reward_earned := TRUE;

    UPDATE card_instances SET
      stamps_collected = v_new_stamps,
      total_stamps_ever = total_stamps_ever + p_value,
      rewards_available = rewards_available + 1,
      last_scanned_at = NOW()
    WHERE id = p_card_instance_id;

    INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
    VALUES (p_card_instance_id, v_instance.business_id, 'reward_earned', 1, p_scanned_by);
  ELSE
    UPDATE card_instances SET
      stamps_collected = v_new_stamps,
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
END;
$$;

-- Fonction: utiliser une recompense
CREATE OR REPLACE FUNCTION redeem_reward(
  p_card_instance_id UUID,
  p_scanned_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
BEGIN
  SELECT * INTO v_instance FROM card_instances WHERE id = p_card_instance_id FOR UPDATE;

  IF v_instance.rewards_available < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune recompense disponible');
  END IF;

  UPDATE card_instances SET
    rewards_available = rewards_available - 1,
    rewards_redeemed = rewards_redeemed + 1
  WHERE id = p_card_instance_id;

  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'reward_redeemed', 1, p_scanned_by);

  RETURN jsonb_build_object('success', true, 'rewards_remaining', v_instance.rewards_available - 1);
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Fonctions helper RLS
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid()), false);
$$;

-- PROFILES policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  is_super_admin() OR id = auth.uid() OR business_id = get_user_business_id()
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  id = auth.uid()
);

-- BUSINESSES policies
CREATE POLICY "businesses_select" ON businesses FOR SELECT USING (
  is_super_admin() OR owner_id = auth.uid() OR id = get_user_business_id()
);
CREATE POLICY "businesses_insert" ON businesses FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY "businesses_update" ON businesses FOR UPDATE USING (
  is_super_admin() OR owner_id = auth.uid()
);

-- CARDS policies
CREATE POLICY "cards_select" ON cards FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "cards_insert" ON cards FOR INSERT WITH CHECK (
  business_id = get_user_business_id() AND get_user_role() IN ('business_owner', 'super_admin')
);
CREATE POLICY "cards_update" ON cards FOR UPDATE USING (
  business_id = get_user_business_id() AND get_user_role() IN ('business_owner', 'super_admin')
);
CREATE POLICY "cards_delete" ON cards FOR DELETE USING (
  business_id = get_user_business_id() AND get_user_role() IN ('business_owner', 'super_admin')
);

-- CLIENTS policies
CREATE POLICY "clients_select" ON clients FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (
  business_id = get_user_business_id()
);

-- CARD_INSTANCES policies
CREATE POLICY "card_instances_select" ON card_instances FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "card_instances_insert" ON card_instances FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);
CREATE POLICY "card_instances_update" ON card_instances FOR UPDATE USING (
  business_id = get_user_business_id()
);

-- TRANSACTIONS policies
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);

-- INVITATIONS policies
CREATE POLICY "invitations_select" ON invitations FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "invitations_insert" ON invitations FOR INSERT WITH CHECK (
  business_id = get_user_business_id() AND get_user_role() = 'business_owner'
);
CREATE POLICY "invitations_update" ON invitations FOR UPDATE USING (
  business_id = get_user_business_id()
);

-- LOCATIONS policies
CREATE POLICY "locations_select" ON locations FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "locations_insert" ON locations FOR INSERT WITH CHECK (
  business_id = get_user_business_id() AND get_user_role() = 'business_owner'
);

-- ============================================
-- STORAGE
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('card-assets', 'card-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: tout le monde peut lire, seuls les auth users peuvent upload
CREATE POLICY "public_read_business_assets" ON storage.objects FOR SELECT USING (bucket_id = 'business-assets');
CREATE POLICY "auth_upload_business_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'business-assets' AND auth.role() = 'authenticated');
CREATE POLICY "auth_update_business_assets" ON storage.objects FOR UPDATE USING (bucket_id = 'business-assets' AND auth.role() = 'authenticated');
CREATE POLICY "auth_delete_business_assets" ON storage.objects FOR DELETE USING (bucket_id = 'business-assets' AND auth.role() = 'authenticated');

CREATE POLICY "public_read_card_assets" ON storage.objects FOR SELECT USING (bucket_id = 'card-assets');
CREATE POLICY "auth_upload_card_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-assets' AND auth.role() = 'authenticated');
CREATE POLICY "auth_update_card_assets" ON storage.objects FOR UPDATE USING (bucket_id = 'card-assets' AND auth.role() = 'authenticated');
CREATE POLICY "auth_delete_card_assets" ON storage.objects FOR DELETE USING (bucket_id = 'card-assets' AND auth.role() = 'authenticated');
