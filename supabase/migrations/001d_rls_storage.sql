-- PARTIE 4 : RLS + STORAGE
-- Copie-colle dans SQL Editor et clique Run

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_business_id() RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT business_id FROM profiles WHERE id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT role FROM profiles WHERE id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT COALESCE((SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid()), false); $$;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (is_super_admin() OR id = auth.uid() OR business_id = get_user_business_id());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "businesses_select" ON businesses FOR SELECT USING (is_super_admin() OR owner_id = auth.uid() OR id = get_user_business_id());
CREATE POLICY "businesses_insert" ON businesses FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "businesses_update" ON businesses FOR UPDATE USING (is_super_admin() OR owner_id = auth.uid());

CREATE POLICY "cards_select" ON cards FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "cards_insert" ON cards FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "cards_update" ON cards FOR UPDATE USING (business_id = get_user_business_id());
CREATE POLICY "cards_delete" ON cards FOR DELETE USING (business_id = get_user_business_id());

CREATE POLICY "clients_select" ON clients FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (business_id = get_user_business_id());

CREATE POLICY "card_instances_select" ON card_instances FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "card_instances_insert" ON card_instances FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "card_instances_update" ON card_instances FOR UPDATE USING (business_id = get_user_business_id());

CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "invitations_select" ON invitations FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "invitations_insert" ON invitations FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "invitations_update" ON invitations FOR UPDATE USING (business_id = get_user_business_id());

CREATE POLICY "locations_select" ON locations FOR SELECT USING (is_super_admin() OR business_id = get_user_business_id());
CREATE POLICY "locations_insert" ON locations FOR INSERT WITH CHECK (business_id = get_user_business_id());

INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('card-assets', 'card-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_business_assets" ON storage.objects FOR SELECT USING (bucket_id = 'business-assets');
CREATE POLICY "auth_upload_business_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'business-assets' AND auth.role() = 'authenticated');
CREATE POLICY "public_read_card_assets" ON storage.objects FOR SELECT USING (bucket_id = 'card-assets');
CREATE POLICY "auth_upload_card_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-assets' AND auth.role() = 'authenticated');
