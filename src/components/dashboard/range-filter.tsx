"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { RANGES, type RangeId } from "@/lib/range";

export function RangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = (params.get("range") as RangeId) || "30d";

  const update = (range: RangeId) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", range);
    startTransition(() => router.push(`?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div
      className={cn(
        "inline-flex items-center bg-beige-dark rounded-full p-1 transition-opacity",
        pending && "opacity-60"
      )}
    >
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => update(r.id)}
          className={cn(
            "px-3 py-1.5 text-sm font-semibold rounded-full transition-all cursor-pointer",
            current === r.id
              ? "bg-yellow text-foreground shadow-sm"
              : "text-foreground/70 hover:text-foreground"
          )}
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
