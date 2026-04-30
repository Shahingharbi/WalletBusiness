-- Apple Wallet PassKit Web Service: tracking des devices iOS qui ont
-- installé un pass. iOS appelle nos endpoints /v1/devices/... pour s'enregistrer
-- avec un push_token APNs ; on stocke ici la correspondance device <-> pass.
--
-- Cycle de vie :
--   1. Customer ajoute le pass à Wallet  -> iOS POST register     -> INSERT row
--   2. Merchant scanne un tampon         -> on push APNs au push_token
--   3. iOS GET /v1/passes/.../<serial>   -> on ressert un .pkpass à jour
--   4. Customer supprime le pass         -> iOS DELETE register   -> DELETE row
--
-- auth_token : généré déterministiquement (HMAC du serial + secret serveur),
-- on stocke quand même la valeur reçue pour audit/debug.

CREATE TABLE apple_pass_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_library_id TEXT NOT NULL,
  pass_type_id TEXT NOT NULL,
  serial_number TEXT NOT NULL,           -- = card_instances.token
  push_token TEXT NOT NULL,              -- APNs push token from device
  auth_token TEXT NOT NULL,              -- random per-pass secret to verify requests
  last_updated_tag TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_library_id, pass_type_id, serial_number)
);

CREATE INDEX apple_pass_devices_serial_idx ON apple_pass_devices (serial_number);
CREATE INDEX apple_pass_devices_device_idx ON apple_pass_devices (device_library_id, pass_type_id);

ALTER TABLE apple_pass_devices ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique : seul le service role (utilisé par les routes API
-- côté serveur, qui valident l'Authorization ApplePass <token> envoyée par iOS)
-- accède à cette table.
