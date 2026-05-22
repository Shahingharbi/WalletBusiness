-- Migration 013 : stockage du dernier message de campagne par instance
--
-- Permet à Apple Wallet d'afficher le CONTENU du message de campagne
-- en notification lockscreen iPhone (au lieu du générique "Pass mis à
-- jour"). Mécanique :
--
-- 1. Une campagne est envoyée à N clients
-- 2. Pour chaque client ciblé, on UPDATE last_campaign_message + _at
-- 3. On déclenche un APNs push silencieux
-- 4. iOS refetch le .pkpass via PassKit Web Service
-- 5. Le .pkpass refetched contient un `backField` "Annonce" avec
--    `changeMessage: "%@"` et la value = last_campaign_message
-- 6. iOS détecte que la value du field a changé vs le pass local →
--    affiche le `changeMessage` rendu sur le lockscreen, contenant
--    le texte exact de l'annonce
--
-- L'index sur last_campaign_at permet le cooldown query rapide
-- (filter instances ciblées dans /api/campaigns POST).

ALTER TABLE card_instances
  ADD COLUMN IF NOT EXISTS last_campaign_message TEXT,
  ADD COLUMN IF NOT EXISTS last_campaign_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_card_instances_last_campaign_at
  ON card_instances (last_campaign_at)
  WHERE last_campaign_at IS NOT NULL;
