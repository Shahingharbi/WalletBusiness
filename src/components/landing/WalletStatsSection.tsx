import { ArrowUp } from "lucide-react";

const mainStats = [
  {
    value: "90%",
    label: "de taux de lecture des notifications wallet",
    comparison: "vs 20% pour l'email",
    source: "Mediametrie",
  },
  {
    value: "4,8x",
    label: "ROI moyen des programmes de fidelite",
    comparison: "34,8% des programmes depassent 500% de ROI",
    source: "Antavo 2025",
  },
  {
    value: "0 EUR",
    label: "par notification push envoyee",
    comparison: "vs 0,01 a 0,05 EUR par SMS",
    source: "Mobiloud",
  },
];

const comparisonData = [
  {
    channel: "Wallet Push",
    openRate: "90%",
    ctr: "22%",
    cost: "Gratuit",
    retention: "85-95%",
    barWidth: "w-[90%]",
    barColor: "bg-yellow",
  },
  {
    channel: "SMS",
    openRate: "98%",
    ctr: "8%",
    cost: "0,05 EUR/msg",
    retention: "N/A",
    barWidth: "w-[98%]",
    barColor: "bg-blue-400",
  },
  {
    channel: "Email",
    openRate: "20%",
    ctr: "1%",
    cost: "0,01 EUR/msg",
    retention: "N/A",
    barWidth: "w-[20%]",
    barColor: "bg-gray-400",
  },
  {
    channel: "App mobile",
    openRate: "15%",
    ctr: "4%",
    cost: "10 000 EUR+",
    retention: "25%",
    barWidth: "w-[15%]",
    barColor: "bg-red-400",
  },
];

const additionalStats = [
  { value: "37,8M", label: "de cartes wallet actives en France", source: "Ifop 2025" },
  { value: "71%", label: "des Francais jugent le wallet utile au quotidien", source: "Ifop 2025" },
  { value: "85%", label: "des utilisateurs y stockent leurs cartes de fidelite", source: "Ifop 2025" },
  { value: "+67%", label: "de depenses par les clients fideles vs nouveaux", source: "Semrush" },
];

export function WalletStatsSection() {
  return (
    <section className="bg-beige py-20 lg:py-[86px]" id="stats">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Le wallet mobile en chiffres
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Des chiffres marche reels et verifiables. Pas nos chiffres, ceux de l&apos;industrie.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {mainStats.map((stat) => (
            <div key={stat.value} className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <ArrowUp size={28} strokeWidth={3} className="text-foreground" />
                <span
                  className="text-5xl lg:text-7xl text-foreground"
                  style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
                >
                  {stat.value}
                </span>
              </div>
              <p className="mt-3 text-base text-foreground font-semibold" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                {stat.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stat.comparison}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Source : {stat.source}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-white p-8 lg:p-10 shadow-sm">
          <h3 className="text-xl lg:text-2xl font-semibold mb-8" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
            Wallet vs SMS vs Email vs App : le comparatif
          </h3>

          <div className="hidden md:grid grid-cols-5 gap-4 pb-4 border-b border-border text-sm font-semibold text-muted-foreground">
            <span>Canal</span>
            <span>Taux d&apos;ouverture</span>
            <span>Taux de clic</span>
            <span>Cout</span>
            <span>Retention carte</span>
          </div>

          {comparisonData.map((row) => (
            <div key={row.channel} className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 py-4 border-b border-border last:border-0">
              <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                {row.channel}
              </span>
              <div className="flex items-center gap-2">
                <span className="md:hidden text-xs text-muted-foreground">Ouverture :</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.barColor} rounded-full ${row.barWidth}`} />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right">{row.openRate}</span>
                </div>
              </div>
              <span className="text-sm text-foreground">
                <span className="md:hidden text-xs text-muted-foreground">CTR : </span>
                {row.ctr}
              </span>
              <span className="text-sm text-foreground">
                <span className="md:hidden text-xs text-muted-foreground">Cout : </span>
                {row.cost}
              </span>
              <span className="text-sm text-foreground">
                <span className="md:hidden text-xs text-muted-foreground">Retention : </span>
                {row.retention}
              </span>
            </div>
          ))}

          <p className="mt-4 text-xs text-muted-foreground">
            Sources : Mediametrie, Mobiloud, PassKit, Rivo. Taux constates sur l&apos;ensemble du marche.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {additionalStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-3xl lg:text-4xl text-foreground" style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}>
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground leading-snug" style={{ fontFamily: "var(--font-maison-neue)" }}>
                {stat.label}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">{stat.source}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
