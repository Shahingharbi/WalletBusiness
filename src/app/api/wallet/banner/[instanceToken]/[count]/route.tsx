import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  BANNER_HEIGHT,
  BANNER_WIDTH,
  buildBannerInput,
  preparePhoto,
  renderBanner,
  resolveBannerKind,
} from "@/lib/banner-render";

export const runtime = "nodejs";

// Bande des cartes Wallet : strip Apple, heroImage Google et aperçu du site.
// 1125×369 = strip Apple @3x (375×123 pt) ; Apple rejette silencieusement une
// strip hors format. Un visuel par type de carte (cf. src/lib/banner-render.tsx) :
//  - stamp      : grille de tampons sur la photo du commerce ;
//  - cashback   : jauge de points « verre dépoli » ;
//  - discount   : sceau promotionnel avec la remise lue dans reward_text ;
//  - membership : plaque premium noir & or « MEMBRE VIP ».
// Sans photo, le fond reste TRANSPARENT : Apple/Google posent la couleur de la
// carte derrière. Aucun champ texte du pass n'est dupliqué ici.

/**
 * Télécharge la photo du commerce (timeout 15 s, 1 retry : utile en cold
 * start Supabase), puis la normalise via `preparePhoto` (sharp → JPEG sRGB
 * 1125×369 que Satori avale toujours, + version floutée pour le verre
 * dépoli). Le commerçant uploade ce qu'il veut (HEIC, PNG géant, CMYK…) : en
 * cas d'échec on renvoie null et la bande retombe sur le fond transparent
 * sans casser le pass.
 */
async function fetchPhoto(
  url: string | null,
  blurred: boolean,
): Promise<Awaited<ReturnType<typeof preparePhoto>>> {
  if (!url) return null;

  let buf: Buffer | null = null;
  for (let attempt = 0; attempt < 2 && !buf; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) {
        console.warn(`[wallet-banner] fetch attempt ${attempt + 1} for ${url}: HTTP ${res.status}`);
        continue;
      }
      const arr = await res.arrayBuffer();
      if (arr.byteLength === 0) continue;
      buf = Buffer.from(arr);
    } catch (err) {
      console.warn(`[wallet-banner] fetch attempt ${attempt + 1} for ${url} threw:`, err);
    }
  }
  if (!buf) return null;

  try {
    return await preparePhoto(buf, { blurred });
  } catch (err) {
    console.warn(
      `[wallet-banner] sharp normalize failed for ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function errorImage(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          color: "white",
          fontSize: 36,
          fontFamily: "system-ui",
        }}
      >
        {message}
      </div>
    ),
    {
      width: BANNER_WIDTH,
      height: BANNER_HEIGHT,
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Content-Type": "image/png",
      },
    },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceToken: string; count: string }> },
) {
  try {
    const { instanceToken } = await params;
    // `?kind=` (posé par apple-wallet.ts / google-wallet.ts / l'essai) reste
    // accepté et prime s'il est valide ; sinon on lit `cards.card_type`.
    // `?v=` (version du design, cf. bannerVersionOf) est volontairement
    // ignoré : il ne sert qu'à changer l'URL (cache Apple / Google / CDN).
    const kindParam = new URL(request.url).searchParams.get("kind");
    const supabase = createAdminClient();

    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(
        `stamps_collected,
         cards(name, card_type, stamp_count, reward_text, design, businesses(name))`,
      )
      .eq("token", instanceToken)
      .single();

    if (error || !instance) return errorImage("Carte introuvable");

    const card = instance.cards as unknown as {
      name: string;
      card_type: string | null;
      stamp_count: number;
      reward_text: string | null;
      design: Record<string, unknown> | null;
      businesses: { name: string } | null;
    };

    const design: Record<string, unknown> = {
      ...DEFAULT_CARD_DESIGN,
      ...(card.design ?? {}),
    };
    const kind = resolveBannerKind(kindParam, card.card_type);

    const bannerSourceUrl = (design.banner_url as string | null) || null;
    // Version floutée seulement pour la jauge de points (verre dépoli).
    const photo = await fetchPhoto(bannerSourceUrl, kind === "cashback");

    const element = renderBanner(
      buildBannerInput({
        kind,
        design,
        stampCount: card.stamp_count,
        stampsCollected: instance.stamps_collected,
        rewardText: card.reward_text,
        photo: photo?.photo ?? null,
        photoBlurred: photo?.photoBlurred ?? null,
        photoLuma: photo?.photoLuma ?? null,
      }),
    );

    return new ImageResponse(element, {
      width: BANNER_WIDTH,
      height: BANNER_HEIGHT,
      headers: {
        // Pas de cache long : après une retouche du design, la nouvelle image
        // doit s'afficher au prochain fetch. Apple/Google re-fetchent quand
        // l'URL change (count après chaque scan, v après chaque retouche).
        "Cache-Control": "public, max-age=10, s-maxage=10, must-revalidate",
        "Content-Type": "image/png",
      },
    });
  } catch (err) {
    console.error("[wallet-banner] error:", err);
    return errorImage("Erreur de rendu");
  }
}
