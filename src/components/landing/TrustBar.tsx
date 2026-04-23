import { MapPin, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

type Item = {
  icon: typeof MapPin;
  label: string;
};

const items: Item[] = [
  { icon: MapPin, label: "Hébergé en Europe" },
  { icon: ShieldCheck, label: "Conforme RGPD" },
  { icon: Lock, label: "Données chiffrées" },
  { icon: CheckCircle2, label: "Sans engagement" },
];

export function TrustBar() {
  return (
    <section className="bg-white border-y border-border">
      <div className="mx-auto max-w-[1280px] px-6 py-5">
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-foreground/70"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          {items.map(({ icon: Icon, label }, i) => (
            <span key={label} className="inline-flex items-center gap-2">
              <Icon size={16} className="text-foreground" />
              <span className="font-semibold text-foreground">{label}</span>
              {i < items.length - 1 && (
                <span className="ml-8 h-4 w-px bg-border hidden md:inline-block" />
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
