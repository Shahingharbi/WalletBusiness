import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import { StampDisplay } from "@/components/cards/stamp-display";
import { formatRelative } from "@/lib/utils";
import { isGoogleWalletConfigured } from "@/lib/google-wallet";
import QRCode from "qrcode";

export default async function CardStatusPage({
  params,
}: {
  params: Promise<{ token: string; instanceToken: string }>;
}) {
  const { token, instanceToken } = await params;
  const supabase = createAdminClient();

  const { data: instance, error } = await supabase
    .from("card_instances")
    .select(`
      id, token, stamps_collected, rewards_available, status, last_scanned_at,
      cards(id, name, stamp_count, reward_text, design, business_id, businesses(id, name, logo_url)),
      clients(id, first_name, phone)
    `)
    .eq("token", instanceToken)
    .single();

  if (error || !instance) {
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
            Cette carte n&apos;existe pas ou a ete supprimee.
          </p>
        </div>
      </div>
    );
  }

  const card = instance.cards as unknown as {
    id: string;
    name: string;
    stamp_count: number;
    reward_text: string;
    design: Record<string, unknown>;
    business_id: string;
    businesses: { id: string; name: string; logo_url: string | null } | null;
  };
  const client = instance.clients as unknown as { id: string; first_name: string; phone: string | null };
  const design = { ...DEFAULT_CARD_DESIGN, ...(card.design || {}) };
  const business = card.businesses;
  const businessName = business?.name ?? "Commerce";
  const logoUrl = (design.logo_url as string | null) ?? business?.logo_url ?? null;

  const stampsRemaining = card.stamp_count - instance.stamps_collected;
  const hasReward = instance.rewards_available > 0;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(instance.token, {
    width: 280,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const googleWalletAvailable = isGoogleWalletConfigured();

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <div
        className="px-6 py-5"
        style={{ backgroundColor: design.accent_color as string }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={businessName}
              className="h-10 w-10 rounded-xl object-cover bg-white shadow-sm"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-white/90 shadow-sm flex items-center justify-center">
              <span className="text-lg font-bold text-gray-700">
                {businessName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <p className="text-white/80 text-xs font-medium">{businessName}</p>
            <h1 className="text-white text-lg font-bold">{card.name}</h1>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 flex-1 space-y-6">
        {/* Welcome */}
        <p className="text-gray-600 text-sm">
          Bonjour <span className="font-semibold text-gray-900">{client.first_name}</span> !
        </p>

        {/* Reward celebration */}
        {hasReward && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 text-center">
            <div className="text-3xl mb-2">&#127881;</div>
            <p className="font-bold text-amber-800 text-lg">
              Vous avez {instance.rewards_available} recompense{instance.rewards_available > 1 ? "s" : ""} disponible{instance.rewards_available > 1 ? "s" : ""} !
            </p>
            <p className="text-amber-700 text-sm mt-1">
              Presentez ce QR code en magasin pour en profiter.
            </p>
          </div>
        )}

        {/* Stamps */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Mes tampons</h2>
            <span className="text-sm font-medium text-gray-500">
              {instance.stamps_collected} / {card.stamp_count}
            </span>
          </div>
          <StampDisplay
            total={card.stamp_count}
            collected={instance.stamps_collected}
            accentColor={design.accent_color as string}
            size="lg"
          />
          {stampsRemaining > 0 && !hasReward && (
            <p className="text-center text-sm text-gray-500 mt-4">
              Plus que <span className="font-semibold text-gray-700">{stampsRemaining} tampon{stampsRemaining > 1 ? "s" : ""}</span> avant votre recompense
            </p>
          )}
        </div>

        {/* Reward text */}
        <div className="rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recompense</span>
          </div>
          <p className="font-semibold text-gray-900">{card.reward_text}</p>
        </div>

        {/* QR Code */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">
            Votre QR code de fidelite
          </p>
          <div className="inline-block bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <img
              src={qrDataUrl}
              alt="QR Code de fidelite"
              className="w-56 h-56"
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Presentez ce code lors de votre prochain passage
          </p>
        </div>

        {/* Wallet buttons */}
        {googleWalletAvailable && (
          <div className="flex flex-col gap-2 items-center">
            <a
              href={`/api/google-wallet/${instance.token}`}
              className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 h-12 rounded-full hover:bg-gray-900 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5l-3.5-3.5L9 11.5l2 2 4-4 1.5 1.5-5.5 5.5z"/>
              </svg>
              Ajouter a Google Wallet
            </a>
            <p className="text-[10px] text-gray-400 text-center">
              Disponible sur Android. Sur iPhone, ajoutez cette page a votre ecran d&apos;accueil.
            </p>
          </div>
        )}

        {/* Last scan */}
        {instance.last_scanned_at && (
          <p className="text-center text-xs text-gray-400">
            Dernier scan : {formatRelative(instance.last_scanned_at)}
          </p>
        )}

        {/* Add to home screen hint */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-center">
          <p className="text-xs text-blue-700">
            Ajoutez cette page a votre ecran d&apos;accueil pour y acceder facilement.
          </p>
        </div>
      </div>
    </div>
  );
}
