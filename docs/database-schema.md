# SCHEMA DE BASE DE DONNEES - FidPass MVP

> Architecture multi-tenant stricte avec Row Level Security (RLS) Supabase
> Seul le type de carte TAMPON est implemente au MVP
> Le champ card_type est prevu pour les futurs types

---

## Vue d'ensemble des tables

```
auth.users (geree par Supabase Auth)
  |
  v
profiles ──────────────── businesses
  |                          |
  |                     +----+----+----+----+
  |                     |         |         |
  |                   cards    clients   locations
  |                     |         |
  |              card_instances───┘
  |                     |
  |              transactions
  |
  v
invitations
```

---

## TABLE : profiles

Extension du user Supabase Auth. Stocke le role et le lien vers le business.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'business_owner', 'employee')),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_profiles_business_id ON profiles(business_id);
CREATE INDEX idx_profiles_role ON profiles(role);
```

**RLS :**
- super_admin : voit tous les profils
- business_owner : voit son propre profil + les employes de son business
- employee : voit uniquement son propre profil

---

## TABLE : businesses

Le commerce/entreprise. Un business_owner peut en avoir plusieurs (V2).

```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly: "mehdi-fast-food"
  logo_url TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'France',
  phone TEXT,
  category TEXT, -- "restaurant", "coiffeur", "boulangerie", etc.
  timezone TEXT DEFAULT 'Europe/Paris',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE UNIQUE INDEX idx_businesses_slug ON businesses(slug);
```

**RLS :**
- super_admin : voit tous les businesses
- business_owner : voit uniquement ses propres businesses (owner_id = auth.uid())
- employee : voit uniquement le business auquel il est rattache

---

## TABLE : cards

La carte de fidelite creee par le commercant. MVP = type "stamp" uniquement.

```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Carte Tampon Kebab"
  card_type TEXT NOT NULL DEFAULT 'stamp' CHECK (card_type IN ('stamp', 'reward', 'membership', 'discount', 'cashback', 'coupon', 'gift', 'multipass')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),

  -- Parametres (specifiques au type stamp au MVP)
  barcode_type TEXT NOT NULL DEFAULT 'qr' CHECK (barcode_type IN ('qr', 'pdf417')),
  stamp_count INTEGER NOT NULL DEFAULT 8 CHECK (stamp_count >= 1 AND stamp_count <= 30),
  reward_text TEXT NOT NULL DEFAULT 'Un repas offert !', -- texte de la recompense
  reward_type TEXT DEFAULT 'free_item', -- "free_item", "discount_percent", "discount_amount"

  -- Expiration
  expiration_type TEXT NOT NULL DEFAULT 'unlimited' CHECK (expiration_type IN ('unlimited', 'fixed_date', 'days_after_install')),
  expiration_date TIMESTAMPTZ, -- si fixed_date
  expiration_days INTEGER, -- si days_after_install

  -- Design (JSON pour flexibilite)
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    design = {
      "logo_url": "https://...",
      "icon_url": "https://...",
      "banner_url": "https://...",
      "background_color": "#ffffff",
      "text_color": "#000000",
      "accent_color": "#e53e3e",
      "stamp_active_icon": "check", -- ou URL custom
      "stamp_inactive_icon": "circle", -- ou URL custom
      "stamp_active_url": null,
      "stamp_inactive_url": null,
      "label_stamps": "Tampons avant recompense",
      "label_rewards": "Recompenses disponibles"
    }
  */

  -- QR code unique pour cette carte (lien vers la page d'installation)
  qr_code_url TEXT, -- genere automatiquement a l'activation

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_cards_business_id ON cards(business_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_card_type ON cards(card_type);
```

**RLS :**
- super_admin : voit toutes les cartes
- business_owner : voit uniquement les cartes de son business
- employee : voit les cartes actives de son business (lecture seule)

---

## TABLE : clients

Les clients finaux (porteurs de cartes). Crees automatiquement quand ils installent une carte.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un client est unique par business + (phone OU email)
  UNIQUE(business_id, phone),
  UNIQUE(business_id, email)
);

-- Index
CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
```

**RLS :**
- super_admin : voit tous les clients
- business_owner : voit uniquement les clients de son business
- employee : voit les clients de son business (lecture seule, sauf ajout de tampons)

---

## TABLE : card_instances

Une "instance" de carte = une carte installee par un client specifique.
C'est la table centrale qui lie un client a une carte avec son etat de progression.

```sql
CREATE TABLE card_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- denormalise pour RLS

  stamps_collected INTEGER NOT NULL DEFAULT 0 CHECK (stamps_collected >= 0),
  rewards_available INTEGER NOT NULL DEFAULT 0 CHECK (rewards_available >= 0),
  rewards_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (rewards_redeemed >= 0),
  total_stamps_ever INTEGER NOT NULL DEFAULT 0 CHECK (total_stamps_ever >= 0), -- compteur historique

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  wallet_type TEXT CHECK (wallet_type IN ('apple', 'google', 'pwa', 'none')),

  installed_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Token unique pour identifier cette carte cote client (dans le QR/barcode)
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un client ne peut avoir qu'une seule instance active par carte
  UNIQUE(card_id, client_id)
);

-- Index
CREATE INDEX idx_card_instances_card_id ON card_instances(card_id);
CREATE INDEX idx_card_instances_client_id ON card_instances(client_id);
CREATE INDEX idx_card_instances_business_id ON card_instances(business_id);
CREATE INDEX idx_card_instances_token ON card_instances(token);
CREATE INDEX idx_card_instances_status ON card_instances(status);
```

**RLS :**
- super_admin : voit tout
- business_owner : voit uniquement les instances de son business
- employee : voit les instances de son business, peut modifier stamps_collected

**Logique metier des tampons :**
```
Quand stamps_collected >= card.stamp_count :
  → stamps_collected = stamps_collected - card.stamp_count
  → rewards_available += 1
  → Le cycle recommence
```

---

## TABLE : transactions

Historique de toutes les actions effectuees sur les card_instances.
Permet l'audit trail complet et les stats.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id UUID NOT NULL REFERENCES card_instances(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- denormalise pour RLS

  type TEXT NOT NULL CHECK (type IN (
    'stamp_add',       -- ajout d'un tampon
    'stamp_remove',    -- retrait d'un tampon (correction)
    'reward_earned',   -- recompense debloquee (auto quand stamps = max)
    'reward_redeemed', -- recompense utilisee par le client
    'card_installed',  -- carte installee par le client
    'card_expired',    -- carte expiree
    'card_revoked'     -- carte revoquee par le marchand
  )),

  value INTEGER DEFAULT 1, -- nombre de tampons ajoutes/retires
  scanned_by UUID REFERENCES auth.users(id), -- l'employe qui a scanne (null si automatique)
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_transactions_card_instance_id ON transactions(card_instance_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_scanned_by ON transactions(scanned_by);
```

**RLS :**
- super_admin : voit tout
- business_owner : voit les transactions de son business
- employee : peut creer des transactions (stamp_add, reward_redeemed) pour son business

---

## TABLE : invitations

Invitations envoyees par un business_owner a ses employes.

```sql
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

-- Index
CREATE INDEX idx_invitations_business_id ON invitations(business_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
```

---

## TABLE : locations (prevu pour V2, cree vide au MVP)

```sql
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
```

---

## FONCTIONS SQL UTILITAIRES

### Fonction : Ajouter un tampon

```sql
CREATE OR REPLACE FUNCTION add_stamp(
  p_card_instance_id UUID,
  p_scanned_by UUID,
  p_value INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
  v_card cards%ROWTYPE;
  v_reward_earned BOOLEAN := FALSE;
BEGIN
  -- Recuperer l'instance et la carte
  SELECT ci.* INTO v_instance FROM card_instances ci WHERE ci.id = p_card_instance_id FOR UPDATE;
  SELECT c.* INTO v_card FROM cards c WHERE c.id = v_instance.card_id;

  -- Verifier que la carte est active
  IF v_instance.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carte inactive');
  END IF;

  -- Ajouter le tampon
  UPDATE card_instances SET
    stamps_collected = stamps_collected + p_value,
    total_stamps_ever = total_stamps_ever + p_value,
    last_scanned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_card_instance_id;

  -- Log la transaction
  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'stamp_add', p_value, p_scanned_by);

  -- Verifier si recompense atteinte
  IF (v_instance.stamps_collected + p_value) >= v_card.stamp_count THEN
    UPDATE card_instances SET
      stamps_collected = stamps_collected - v_card.stamp_count,
      rewards_available = rewards_available + 1,
      updated_at = NOW()
    WHERE id = p_card_instance_id;

    INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
    VALUES (p_card_instance_id, v_instance.business_id, 'reward_earned', 1, p_scanned_by);

    v_reward_earned := TRUE;
  END IF;

  -- Retourner le resultat
  SELECT ci.* INTO v_instance FROM card_instances ci WHERE ci.id = p_card_instance_id;

  RETURN jsonb_build_object(
    'success', true,
    'stamps_collected', v_instance.stamps_collected,
    'rewards_available', v_instance.rewards_available,
    'reward_earned', v_reward_earned,
    'stamp_count', v_card.stamp_count,
    'reward_text', v_card.reward_text
  );
END;
$$;
```

### Fonction : Utiliser une recompense

```sql
CREATE OR REPLACE FUNCTION redeem_reward(
  p_card_instance_id UUID,
  p_scanned_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance card_instances%ROWTYPE;
BEGIN
  SELECT ci.* INTO v_instance FROM card_instances ci WHERE ci.id = p_card_instance_id FOR UPDATE;

  IF v_instance.rewards_available < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune recompense disponible');
  END IF;

  UPDATE card_instances SET
    rewards_available = rewards_available - 1,
    rewards_redeemed = rewards_redeemed + 1,
    updated_at = NOW()
  WHERE id = p_card_instance_id;

  INSERT INTO transactions (card_instance_id, business_id, type, value, scanned_by)
  VALUES (p_card_instance_id, v_instance.business_id, 'reward_redeemed', 1, p_scanned_by);

  RETURN jsonb_build_object('success', true, 'rewards_remaining', v_instance.rewards_available - 1);
END;
$$;
```

---

## POLICIES RLS (Row Level Security)

### Activer RLS sur toutes les tables

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
```

### Fonction helper : recuperer le business_id de l'utilisateur courant

```sql
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid();
$$;
```

### Policies pour businesses

```sql
-- SELECT: owner voit ses businesses, admin voit tout
CREATE POLICY "businesses_select" ON businesses FOR SELECT USING (
  is_super_admin() OR owner_id = auth.uid() OR id = get_user_business_id()
);

-- INSERT: seuls les business_owners peuvent creer
CREATE POLICY "businesses_insert" ON businesses FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);

-- UPDATE: seul le owner peut modifier
CREATE POLICY "businesses_update" ON businesses FOR UPDATE USING (
  is_super_admin() OR owner_id = auth.uid()
);
```

### Policies pour cards, clients, card_instances, transactions

```sql
-- Pattern commun: filtre par business_id
CREATE POLICY "cards_select" ON cards FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "cards_insert" ON cards FOR INSERT WITH CHECK (
  business_id = get_user_business_id() AND get_user_role() = 'business_owner'
);
CREATE POLICY "cards_update" ON cards FOR UPDATE USING (
  business_id = get_user_business_id() AND get_user_role() = 'business_owner'
);
CREATE POLICY "cards_delete" ON cards FOR DELETE USING (
  business_id = get_user_business_id() AND get_user_role() = 'business_owner'
);

-- Clients: meme pattern
CREATE POLICY "clients_select" ON clients FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (
  business_id = get_user_business_id()
);

-- Card instances: meme pattern
CREATE POLICY "card_instances_select" ON card_instances FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "card_instances_insert" ON card_instances FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);
CREATE POLICY "card_instances_update" ON card_instances FOR UPDATE USING (
  business_id = get_user_business_id()
);

-- Transactions: lecture pour owner+employee, ecriture pour employee via fonction
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  is_super_admin() OR business_id = get_user_business_id()
);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  business_id = get_user_business_id()
);
```

---

## TRIGGERS

### Mise a jour automatique de updated_at

```sql
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
```

### Creation automatique du profil apres inscription

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, role, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'business_owner'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## STORAGE BUCKETS (Supabase Storage)

```sql
-- Bucket pour les logos et images des businesses
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true);

-- Bucket pour les designs de cartes (logos, bannieres, icones tampons)
INSERT INTO storage.buckets (id, name, public) VALUES ('card-assets', 'card-assets', true);

-- Policies storage: seul le business_owner peut uploader dans son dossier
-- Dossier structure: {business_id}/{card_id}/logo.png etc.
```
