"use client";

import { cn } from "@/lib/utils";
import { CARD_TEMPLATES, type CardTemplate } from "@/lib/card-templates";
import { CARD_TYPES } from "@/lib/constants";
import { STAMP_ICONS, getStampIcon } from "@/lib/stamp-icons";

interface StepTemplateProps {
  selectedId: string | null;
  onSelect: (template: CardTemplate) => void;
}

function MiniCard({ tpl }: { tpl: CardTemplate }) {
  const { background_color, accent_color, text_color, stamp_icon, banner_url } = tpl.design;
  const { Icon } = STAMP_ICONS[getStampIcon(stamp_icon)];

  return (
    <div
      className="relative h-32 w-full overflow-hidden rounded-t-xl"
      style={{
        background: `linear-gradient(135deg, ${accent_color}22 0%, ${background_color} 55%, ${background_color} 100%)`,
      }}
    >
      {/* Photo as backdrop */}
      {banner_url && (
        <>
          <img
            src={banner_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${accent_color}40 0%, ${background_color}f0 85%)`,
            }}
          />
        </>
      )}

      {/* Mini wallet card */}
      <div
        className="absolute inset-x-3 bottom-1 top-12 rounded-lg shadow-md flex flex-col backdrop-blur-[1px]"
        style={{ backgroundColor: background_color }}
      >
        {/* Strip */}
        <div
          className="h-3.5 rounded-t-lg flex items-center px-1.5 gap-1"
          style={{ backgroundColor: accent_color }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
          <div className="h-1 w-6 rounded-full bg-white/50" />
        </div>

        {/* Body */}
        <div className="flex-1 flex items-center justify-between px-2 py-1.5 gap-1.5 min-h-0">
          <div className="flex flex-wrap gap-[2px] items-center">
            {Array.from({ length: Math.min(6, tpl.stampCount) }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 w-2.5 rounded-full flex items-center justify-center text-white"
                style={{
                  backgroundColor: i < 3 ? accent_color : `${accent_color}25`,
                }}
              >
                {i < 3 && <Icon className="h-1.5 w-1.5" />}
              </div>
            ))}
          </div>
          <div className="text-right">
            <div
              className="text-[7px] font-bold leading-none truncate max-w-[70px]"
              style={{ color: text_color }}
            >
              {tpl.name.split(" ")[0] || "Carte"}
            </div>
            <div
              className="text-[6px] mt-0.5"
              style={{ color: accent_color }}
            >
              {CARD_TYPES[tpl.type].label}
            </div>
          </div>
        </div>

        {/* Barcode strip */}
        <div className="h-2 bg-neutral-100 flex items-center justify-center rounded-b-lg gap-[1px]">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="bg-black/70 h-1 rounded-sm"
              style={{ width: i % 3 === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StepTemplate({ selectedId, onSelect }: StepTemplateProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Choisissez un modele
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Demarrez avec un template pre-conçu, vous pourrez tout personnaliser ensuite.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CARD_TEMPLATES.map((tpl) => {
          const isSelected = selectedId === tpl.id;
          const accentColor = tpl.design.accent_color;

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl)}
              className={cn(
                "group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 transition-all duration-150 cursor-pointer bg-white",
                isSelected
                  ? "border-black shadow-md scale-[1.02]"
                  : "border-gray-200 hover:border-gray-400 hover:shadow-sm"
              )}
            >
              <MiniCard tpl={tpl} />

              <div className="px-3 py-2.5 text-left border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {tpl.label}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {CARD_TYPES[tpl.type].label} · {tpl.stampCount > 1 ? `${tpl.stampCount} tampons` : "1 palier"}
                </p>
              </div>

              {isSelected && (
                <div
                  className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
