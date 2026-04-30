// APNs (Apple Push Notification service) pour PassKit live updates.
//
// Quand un commerçant scanne un tampon, on push (silencieusement) les iPhones
// qui ont installé le pass : iOS rappelle alors notre /v1/passes/... pour
// récupérer le .pkpass à jour.
//
// Stack : HTTP/2 brut via `node:http2` (aucune dépendance ajoutée).
//
// Auth : Apple accepte que le MÊME certificat de Pass Type ID soit utilisé
// comme cert client TLS pour APNs (pas besoin de cert APNs séparé). On réutilise
// donc APPLE_WALLET_SIGNER_CERT_BASE64 / APPLE_WALLET_SIGNER_KEY_BASE64
// (PEM-encoded, base64).

import http2 from "node:http2";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplePassTypeId } from "@/lib/apple-wallet";

const APNS_HOST = "api.push.apple.com";
const APNS_PORT = 443;

// Cache de la session HTTP/2 — la créer à chaque push est lent (handshake TLS).
// Dans Next/Vercel les requêtes serverless se partagent le module, donc on
// peut amortir le coût quand plusieurs pushes arrivent en rafale.
let cachedSession: http2.ClientHttp2Session | null = null;

function getApnsCredentials(): { cert: Buffer; key: Buffer; passphrase?: string } | null {
  const certB64 = process.env.APPLE_WALLET_SIGNER_CERT_BASE64;
  const keyB64 = process.env.APPLE_WALLET_SIGNER_KEY_BASE64;
  const passphrase = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined;
  if (!certB64 || !keyB64) return null;
  return {
    cert: Buffer.from(certB64, "base64"),
    key: Buffer.from(keyB64, "base64"),
    passphrase,
  };
}

function getOrCreateSession(): http2.ClientHttp2Session {
  if (cachedSession && !cachedSession.closed && !cachedSession.destroyed) {
    return cachedSession;
  }
  const creds = getApnsCredentials();
  if (!creds) {
    throw new Error("Apple Wallet signer cert/key not configured for APNs");
  }
  const session = http2.connect(`https://${APNS_HOST}:${APNS_PORT}`, {
    cert: creds.cert,
    key: creds.key,
    passphrase: creds.passphrase,
  });
  session.on("error", (err) => {
    console.error("[apple-wallet-push] APNs session error:", err);
  });
  session.on("close", () => {
    if (cachedSession === session) cachedSession = null;
  });
  cachedSession = session;
  return session;
}

interface ApnsPushResult {
  pushToken: string;
  status: number;
  reason?: string;
}

/**
 * Envoie un push silencieux à un seul push token. Body = `{}` (PassKit pushes
 * sont silencieux : iOS reconnait l'apns-topic = pass type id et déclenche
 * le refresh du pass).
 */
function sendSinglePush(pushToken: string, passTypeId: string): Promise<ApnsPushResult> {
  return new Promise((resolve) => {
    let session: http2.ClientHttp2Session;
    try {
      session = getOrCreateSession();
    } catch (err) {
      resolve({
        pushToken,
        status: 0,
        reason: err instanceof Error ? err.message : "session-error",
      });
      return;
    }

    const body = "{}";
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      "apns-topic": passTypeId,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    let payload = "";

    req.on("response", (headers) => {
      const s = headers[":status"];
      status = typeof s === "number" ? s : Number(s ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      payload += chunk;
    });
    req.on("end", () => {
      let reason: string | undefined;
      if (payload) {
        try {
          const parsed = JSON.parse(payload) as { reason?: string };
          reason = parsed.reason;
        } catch {
          reason = payload.slice(0, 200);
        }
      }
      resolve({ pushToken, status, reason });
    });
    req.on("error", (err) => {
      resolve({
        pushToken,
        status: 0,
        reason: err instanceof Error ? err.message : "request-error",
      });
    });

    req.end(body);
  });
}

/**
 * Push tous les devices iOS qui ont installé le pass identifié par `serialNumber`
 * (= card_instances.token). Fire-and-forget côté caller : tout est swallowed,
 * mais log les erreurs pour le debug.
 *
 * Si APNs renvoie 410 (BadDeviceToken) ou 400 (Unregistered/etc.), on supprime
 * la row du device : ce push token n'est plus valide (pass désinstallé).
 */
export async function pushAppleWalletUpdate(serialNumber: string): Promise<void> {
  const passTypeId = getApplePassTypeId();
  if (!passTypeId) {
    console.warn("[apple-wallet-push] APPLE_PASS_TYPE_ID not configured, skipping push");
    return;
  }

  const creds = getApnsCredentials();
  if (!creds) {
    console.warn("[apple-wallet-push] signer cert/key not configured, skipping push");
    return;
  }

  const admin = createAdminClient();
  const { data: devices, error } = await admin
    .from("apple_pass_devices")
    .select("id, push_token")
    .eq("serial_number", serialNumber)
    .eq("pass_type_id", passTypeId);

  if (error) {
    console.error("[apple-wallet-push] failed to load devices:", error);
    return;
  }
  if (!devices || devices.length === 0) {
    return;
  }

  const results = await Promise.all(
    devices.map((d) => sendSinglePush(d.push_token, passTypeId))
  );

  const stale: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const dev = devices[i];
    if (r.status === 200) continue;
    console.warn(
      `[apple-wallet-push] push failed token=${r.pushToken.slice(0, 8)}... status=${r.status} reason=${r.reason ?? "n/a"}`
    );
    // 410 Gone = device token n'est plus valide. 400 + reason BadDeviceToken aussi.
    if (
      r.status === 410 ||
      r.reason === "BadDeviceToken" ||
      r.reason === "Unregistered" ||
      r.reason === "DeviceTokenNotForTopic"
    ) {
      stale.push(dev.id);
    }
  }

  if (stale.length > 0) {
    await admin.from("apple_pass_devices").delete().in("id", stale);
  }
}
