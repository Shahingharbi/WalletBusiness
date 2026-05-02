import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import { pickContrast } from "@/lib/utils";
import { InstallForm } from "./install-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data: card } = await supabase
    .from("cards")
    .select("name, reward_text, design, businesses(name, logo_url)")
    .eq("id", token)
    .maybeSingle();

  if (!card) {
    return { title: "Carte introuvable - aswallet" };
  }

  const business = card.businesses as unknown as {
    name: string;
    logo_url: string | null;
  } | null;
  const design = (card.design || {}) as { banner_url?: string | null };
  const businessName = business?.name ?? "";
  const title = `${card.name} - ${businessName}`;
  const description = `Recevez ${card.reward_text} grâce à votre carte de fidélité.`;
  const image = design.banner_url ?? business?.logo_url ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CardInstallPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("id, name, max_stamps:stamp_count, reward_text, status, design, business_id, businesses(id, name, logo_url, slug)")
    .eq("id", token)
    .single();

  if (error || !card || card.status !== "active") {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Carte introuvable
          </h1>
          <p className="text-gray-500 text-sm">
            Cette carte n&apos;existe pas ou n&apos;est plus active.
          </p>
        </div>
      </div>
    );
  }

  const design = { ...DEFAULT_CARD_DESIGN, ...(card.design as Record<string, unknown>) };
  const business = card.businesses as unknown as { id: string; name: string; logo_url: string | null; slug: string } | null;
  const businessName = business?.name ?? "Commerce";
  const logoUrl = (design.logo_url as string | null) ?? business?.logo_url ?? null;
  // Auto-contraste : sans banner image, le titre apparaît sur l'accent_color
  // pur. Si l'accent est très clair (blanc, pastel), du texte blanc devient
  // illisible. On bascule sur du texte foncé.
  const hasBanner = Boolean(design.banner_url);
  const headerTextColor = hasBanner ? "#ffffff" : pickContrast(design.accent_color as string);
  const headerSubTextColor = hasBanner ? "rgba(255,255,255,0.8)" : (headerTextColor === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(20,20,20,0.7)");

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Banner / Header */}
      <div
        className="relative h-40 sm:h-48 flex items-end"
        style={{
          backgroundColor: design.accent_color as string,
          backgroundImage: design.banner_url ? `url(${design.banner_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {hasBanner && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        )}
        <div className="relative z-10 px-4 sm:px-6 pb-5 w-full">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="h-12 w-12 rounded-xl object-cover bg-white shadow-md shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-white/90 shadow-md flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-gray-700">
                  {businessName.charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: headerSubTextColor }}>{businessName}</p>
              <h1 className="text-lg sm:text-xl font-bold break-words" style={{ color: headerTextColor }}>{card.name}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Card details */}
      <div className="px-4 sm:px-6 py-6 flex-1 max-w-lg w-full mx-auto">
        {/* Reward info */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h2 className="font-semibold text-gray-900">Récompense</h2>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            Collectez <span className="font-bold text-gray-900">{card.max_stamps} tampons</span> et gagnez :
          </p>
          <p
            className="text-base font-semibold"
            style={{
              // Garde la couleur accent quand elle est lisible sur fond gris
              // clair, sinon (accent quasi-blanc) fallback sur du texte foncé.
              color:
                pickContrast(design.accent_color as string) === "#ffffff"
                  ? (design.accent_color as string)
                  : "#111827",
            }}
          >
            {card.reward_text}
          </p>
        </div>

        {/* Install form */}
        <InstallForm
          cardId={card.id}
          accentColor={design.accent_color as string}
          businessName={businessName}
        />
      </div>
    </div>
  );
}
