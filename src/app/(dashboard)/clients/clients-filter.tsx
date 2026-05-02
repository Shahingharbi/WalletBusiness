"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEGMENT_LABELS, SEGMENT_ORDER } from "@/lib/rfm";

type FilterId =
  | "all"
  | "active"
  | "inactive"
  | "rewards"
  | (typeof SEGMENT_ORDER)[number];

const STATIC_FILTERS: ReadonlyArray<{ id: FilterId; label: string; emoji?: string }> = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs (30 j)" },
  { id: "inactive", label: "Inactifs (>30 j)" },
  { id: "rewards", label: "Récompense dispo" },
];

const SEGMENT_FILTERS: ReadonlyArray<{ id: FilterId; label: string; emoji: string }> =
  SEGMENT_ORDER.map((s) => ({
    id: s,
    label: SEGMENT_LABELS[s].label,
    emoji: SEGMENT_LABELS[s].emoji,
  }));

interface ClientsFilterProps {
  currentFilter: string;
  initialQuery: string;
  counts: Record<string, number>;
}

export function ClientsFilter({
  currentFilter,
  initialQuery,
  counts,
}: ClientsFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const updateParams = (updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v.length > 0) sp.set(k, v);
      else sp.delete(k);
    }
    startTransition(() => router.push(`?${sp.toString()}`, { scroll: false }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: query.trim() });
  };

  const renderPill = (
    id: FilterId,
    label: string,
    emoji: string | undefined,
    count: number
  ) => {
    const active = currentFilter === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() =>
          updateParams({ filter: id === "all" ? undefined : id })
        }
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-full border transition-all cursor-pointer",
          active
            ? "bg-black text-white border-black"
            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
        )}
      >
        {emoji && <span className="mr-1">{emoji}</span>}
        {label}
        <span
          className={cn(
            "ml-1.5 text-xs",
            active ? "text-gray-300" : "text-gray-400"
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-11 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              updateParams({ q: undefined });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Effacer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div
        className={cn(
          "flex flex-col gap-2 transition-opacity",
          pending && "opacity-60"
        )}
      >
        <div className="inline-flex flex-wrap gap-1.5">
          {STATIC_FILTERS.map((f) =>
            renderPill(f.id, f.label, undefined, counts[f.id] ?? 0)
          )}
        </div>
        <div className="inline-flex flex-wrap gap-1.5">
          {SEGMENT_FILTERS.map((f) =>
            renderPill(f.id, f.label, f.emoji, counts[f.id] ?? 0)
          )}
        </div>
      </div>
    </div>
  );
}
