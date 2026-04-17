-- PARTIE 2 : INDEX + TRIGGERS
-- Copie-colle dans SQL Editor et clique Run

CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_profiles_business_id ON profiles(business_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_cards_business_id ON cards(business_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_card_instances_card_id ON card_instances(card_id);
CREATE INDEX idx_card_instances_client_id ON card_instances(client_id);
CREATE INDEX idx_card_instances_business_id ON card_instances(business_id);
CREATE INDEX idx_card_instances_token ON card_instances(token);
CREATE INDEX idx_transactions_card_instance_id ON transactions(card_instance_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_invitations_business_id ON invitations(business_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_locations_business_id ON locations(business_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_card_instances_updated_at BEFORE UPDATE ON card_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
