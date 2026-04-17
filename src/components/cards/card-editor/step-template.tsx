"use client";

import { cn } from "@/lib/utils";
import { CARD_TEMPLATES, type CardTemplate } from "@/lib/card-templates";
import { CARD_TYPES } from "@/lib/constants";

interface StepTemplateProps {
  selectedId: string | null;
  onSelect: (template: CardTemplate) => void;
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CARD_TEMPLATES.map((tpl) => {
          const isSelected = selectedId === tpl.id;
          const accentColor = tpl.design.accent_color;
          const bgColor = tpl.design.background_color;
          const textColor = tpl.design.text_color;

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl)}
              className={cn(
                "group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 transition-all duration-150 cursor-pointer",
                isSelected
                  ? "border-black shadow-md scale-[1.02]"
                  : "border-gray-200 hover:border-gray-400 hover:shadow-sm"
              )}
            >
              <div
                className="h-20 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: bgColor }}
              >
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor} 0%, transparent 70%)`,
                  }}
                />
                <span className="relative text-3xl">{tpl.emoji}</span>
              </div>
              <div className="bg-white px-3 py-2.5 text-left">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {tpl.label}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {CARD_TYPES[tpl.type].label}
                </p>
              </div>
              {isSelected && (
                <div
                  className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: accentColor, color: textColor }}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
