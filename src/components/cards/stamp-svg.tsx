"use client";

import {
  getIconPath,
  getShapePath,
  normalizeIconKey,
  normalizeShape,
  type StampShape,
} from "@/lib/stamp-render";

/**
 * Source de vérité UNIQUE pour le rendu visuel d'un tampon dans le client React.
 *
 * Trois call-sites consomment ce composant :
 *  - `card-preview.tsx`  (l'aperçu wallet dans l'éditeur)
 *  - `stamp-display.tsx` (la grille des tampons sur la page status client)
 *  - banner endpoint     (rendu côté server pour la strip image embarquée
 *                         dans Apple/Google Wallet — utilise les MÊMES
 *                         `getShapePath` / `getIconPath` de `lib/stamp-render`,
 *                         donc pixel-parity garantie)
 *
 * Auparavant, ces 3 endroits avaient chacun leur propre rendu — d'où des
 * incohérences visibles (rempli/vide inversés sur la status page, etc.).
 * Tout passe désormais par ici.
 *
 * Convention finalisée :
 *   REMPLI  -> fond accent plein, icône blanche, drop-shadow forte
 *   VIDE    -> fond blanc opaque, bord accent FORT (1.6), icône accent 22 %,
 *              drop-shadow douce. Visible sur n'importe quel fond (photo,
 *              dégradé, accent vif, etc.)
 */

interface StampSvgProps {
  filled: boolean;
  /** Taille en pixels (carré). */
  size: number;
  /** Couleur d'accent du merchant (hex `#rrggbb`). */
  accent: string;
  /** Forme extérieure (circle / squircle / shield / star / hex). */
  shape?: string | null;
  /** Clé d'icône intérieure (check / star / heart / kebab / coffee / ...). */
  iconKey?: string | null;
  /**
   * Image custom uploadée par le merchant (override de l'icône SVG). Si
   * fournie, on rend cette image dans une boîte blanche arrondie. Le
   * paramètre `inactiveUrl` peut contenir une variante "vide".
   */
  activeUrl?: string | null;
  inactiveUrl?: string | null;
  /** Anim "pop" quand on passe de vide à rempli — useful sur la status page. */
  animated?: boolean;
}

export function StampSvg({
  filled,
  size,
  accent,
  shape,
  iconKey,
  activeUrl,
  inactiveUrl,
  animated = false,
}: StampSvgProps) {
  const normalizedShape = normalizeShape(shape);
  const normalizedIcon = normalizeIconKey(iconKey ?? null, "check");
  const shapePath = getShapePath(normalizedShape);
  const iconPath = getIconPath(normalizedIcon);

  // Branche "image custom" : le merchant a uploadé une photo de tampon.
  // On approxime la shape via border-radius (compromis pratique : Satori
  // côté banner endpoint fait pareil — pixel-parity assurée).
  const url = filled ? activeUrl : inactiveUrl;
  if (url) {
    const radius =
      normalizedShape === "circle"
        ? "50%"
        : normalizedShape === "squircle"
          ? "30%"
          : "12%";
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          opacity: filled ? 1 : 0.5,
          border: filled ? "none" : `2px solid ${accent}`,
          boxShadow: filled
            ? "0 8px 18px rgba(0,0,0,0.32)"
            : "0 3px 8px rgba(0,0,0,0.20)",
        }}
        className={animated && filled ? "animate-stamp-pop" : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      </div>
    );
  }

  if (filled) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.28))",
        }}
        className={animated ? "animate-stamp-pop" : undefined}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path
            d={shapePath}
            fill={accent}
            stroke={accent}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
          <path d={iconPath} fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // Vide : fond BLANC opaque + bord accent FORT + icône accent 22 % + ombre.
  // Visible sur photo, fond accent vif, fond sombre, fond clair — peu importe.
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.22))",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
        <path
          d={shapePath}
          fill="#ffffff"
          stroke={accent}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path d={iconPath} fill={accent} opacity={0.22} />
      </svg>
    </div>
  );
}

/**
 * Re-export des types pour faciliter l'usage côté caller.
 */
export type { StampShape };
