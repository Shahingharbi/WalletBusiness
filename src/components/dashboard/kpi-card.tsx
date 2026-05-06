import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  previousValue?: number;
  format?: "number" | "percent";
  placeholder?: boolean;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  previousValue,
  format = "number",
  placeholder = false,
}: KpiCardProps) {
  // Affiche la comparaison UNIQUEMENT si on a un base period non-trivial
  // (au moins 1 entrée). Avec previousValue=0 et value=0, "0 vs 0" affichait
  // "0 vs période précédente" → bruit visuel inutile. Avec previousValue=0
  // et value>0, on affichait juste "+N" sans %, OK. Avec previousValue>0 et
  // value=0, on affichait "-100%" rouge alarmant — exact mais effrayant
  // (filtre "Aujourd'hui" matin précoce, normal qu'on n'ait pas encore de
  // scans). On garde -100% mais avec un wording moins anxiogène.
  const hasComparison =
    typeof previousValue === "number" &&
    previousValue !== undefined &&
    !(previousValue === 0 && value === 0);
  const delta = hasComparison ? value - previousValue : 0;
  const pctChange =
    hasComparison && previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : null;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  const formatValue = (v: number) => {
    if (format === "percent") return `${Math.round(v)}%`;
    return v.toLocaleString("fr-FR");
  };

  return (
    <Card
      className={cn(
        "p-5 border-beige-dark",
        placeholder && "bg-gray-50/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 min-w-0 flex-1">
          <p
            className="text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold leading-tight"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-4xl",
              placeholder ? "text-gray-300" : "text-foreground"
            )}
            style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
          >
            {formatValue(value)}
          </p>
          {hasComparison && (
            <div className="flex items-center gap-1 text-xs">
              {trend === "up" && (
                <TrendingUp className="h-3.5 w-3.5 text-green-700" />
              )}
              {trend === "down" && (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
              {trend === "flat" && (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  trend === "up" && "text-green-700",
                  trend === "down" && "text-red-600",
                  trend === "flat" && "text-muted-foreground"
                )}
              >
                {pctChange !== null
                  ? `${pctChange > 0 ? "+" : ""}${Math.round(pctChange)}%`
                  : delta > 0
                    ? `+${delta}`
                    : delta < 0
                      ? `${delta}`
                      : "0"}
              </span>
              <span className="text-muted-foreground">vs période précédente</span>
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
      </div>
    </Card>
  );
}
