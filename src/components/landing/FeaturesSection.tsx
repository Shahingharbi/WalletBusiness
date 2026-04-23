export function FeaturesSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="features">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold max-w-3xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Tout ce qu&apos;il faut pour faire revenir vos clients
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Pas de gadgets. Juste les outils qui remplissent votre commerce,
          sans que vous touchiez une ligne de code.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Push notifications (most compelling) */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-yellow/30 p-6 relative overflow-hidden">
              <div className="space-y-2">
                {[2, -1, 0].map((tx, idx) => (
                  <div
                    key={idx}
                    className={`bg-white rounded-lg p-2.5 shadow-sm flex items-center gap-2 ${idx === 2 ? "opacity-60" : ""}`}
                    style={{ transform: `translateX(${tx * 4}px)` }}
                  >
                    <div className="w-5 h-5 rounded bg-yellow flex-shrink-0" />
                    <div>
                      <div className="w-20 h-1.5 rounded bg-foreground/20" />
                      <div className="w-32 h-1 rounded bg-foreground/10 mt-1" />
                    </div>
                    <span className="text-[7px] text-green-600 font-bold ml-auto">Gratuit</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                0 EUR / message
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Remplissez les creux de la journee
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                Une offre flash &laquo;&nbsp;-20% entre 15h et 17h&nbsp;&raquo; en 2 clics, envoyee gratuitement
                dans le wallet de tous vos clients. 0 EUR contre 0,05 EUR par SMS.
              </p>
            </div>
          </div>

          {/* Feature 2: Dashboard & analytics */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-green-50 p-6">
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-semibold text-foreground">Tableau de bord</span>
                  <span className="text-[8px] text-muted-foreground">Temps reel</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-beige rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-ginto-nord)" }}>248</p>
                    <p className="text-[7px] text-muted-foreground">Clients</p>
                  </div>
                  <div className="bg-beige rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-green-600" style={{ fontFamily: "var(--font-ginto-nord)" }}>72%</p>
                    <p className="text-[7px] text-muted-foreground">Retour</p>
                  </div>
                  <div className="bg-beige rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-ginto-nord)" }}>34</p>
                    <p className="text-[7px] text-muted-foreground">Scans/j</p>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-10">
                  {[30, 50, 40, 70, 55, 80, 65, 90, 75, 85, 95, 80].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-green-400 to-green-300" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                Stats en temps reel
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Sachez enfin qui revient (et qui ne revient plus)
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                Voyez vos scans du jour, votre taux de retour, vos clients inactifs a relancer.
                Toutes les donnees que votre caisse ne vous donne pas.
              </p>
            </div>
          </div>

          {/* Feature 3: 0 materiel / compatible caisses */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-orange-50 p-6">
              <div className="flex items-end justify-center gap-4">
                <div className="relative">
                  <div className="w-20 h-14 rounded-t-lg bg-stone-400" />
                  <div className="w-24 h-8 rounded bg-stone-500 flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-0.5">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-sm bg-stone-300" />
                      ))}
                    </div>
                  </div>
                  <div className="w-24 h-2 rounded-b bg-stone-600" />
                </div>
                <div className="mb-4 text-2xl font-bold text-orange-400">+</div>
                <div className="w-12 h-20 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-600 p-1 mb-1">
                  <div className="w-full h-full rounded-lg bg-white flex flex-col items-center justify-center">
                    <div className="w-5 h-5 rounded bg-yellow mb-1" />
                    <div className="text-[6px] font-bold text-green-600">Scan</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                0 materiel
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Aucune caisse a changer, rien a installer
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                aswallet vit sur votre smartphone, a cote de votre caisse actuelle.
                Aucun achat de materiel, aucune formation, aucune integration.
              </p>
            </div>
          </div>

          {/* Feature 4: Geolocalisation */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-blue-50 p-6 relative overflow-hidden">
              <div className="relative h-[120px]">
                <div className="absolute inset-0 opacity-20">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex gap-0">
                      {[0, 1, 2, 3, 4, 5].map((col) => (
                        <div key={col} className="flex-1 aspect-square border border-blue-300/50" />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm">&#128205;</span>
                    </div>
                    <div className="absolute inset-0 w-8 h-8 rounded-full bg-blue-400/30 animate-ping" />
                    <div className="absolute -inset-4 w-16 h-16 rounded-full border-2 border-blue-300/30" />
                    <div className="absolute -inset-8 w-24 h-24 rounded-full border border-blue-200/20" />
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-white rounded-lg p-2 shadow-md">
                  <p className="text-[8px] font-semibold text-foreground">Client a proximite !</p>
                  <p className="text-[7px] text-muted-foreground">Notification envoyee</p>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                3x plus d&apos;interactions
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Attrapez vos clients quand ils passent devant
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                Des qu&apos;un client s&apos;approche de votre commerce, une offre pop dans son
                wallet. Le bon message, au bon moment, sans rien faire.
              </p>
            </div>
          </div>

          {/* Feature 5: Personnalisation */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-purple-50 p-6">
              <div className="flex gap-3 justify-center">
                {[
                  { from: "from-purple-500", to: "to-purple-700", rot: "-rotate-6", scale: "" },
                  { from: "from-yellow", to: "to-orange-400", rot: "rotate-2", scale: "scale-110 z-10" },
                  { from: "from-teal-500", to: "to-teal-700", rot: "rotate-6", scale: "" },
                ].map((c, i) => (
                  <div key={i} className={`w-20 rounded-xl bg-gradient-to-br ${c.from} ${c.to} p-2.5 shadow-md transform ${c.rot} ${c.scale}`}>
                    <div className="w-4 h-4 rounded-full bg-white/30 mb-2" />
                    <div className="w-10 h-1 rounded bg-white/40 mb-1" />
                    <div className="w-8 h-1 rounded bg-white/30" />
                    <div className="flex gap-0.5 mt-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className={`w-2 h-2 rounded-full ${i === 1 && j <= 3 ? "bg-white" : "bg-white/40"}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                Votre identite
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Votre logo, vos couleurs, votre carte
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                Tampons, points ou cashback&nbsp;: choisissez votre mecanique. Logo et couleurs en
                3 clics. Vos clients reconnaissent votre commerce dans leur wallet en un coup d&apos;oeil.
              </p>
            </div>
          </div>

          {/* Feature 6: Setup rapide */}
          <div className="flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-rose-50 p-6">
              <div className="space-y-3">
                {[
                  { num: "1", color: "bg-rose-200", textColor: "text-rose-600", label: "Inscription", time: "30 sec" },
                  { num: "2", color: "bg-rose-300", textColor: "text-white", label: "Personnalisation", time: "3 min" },
                  { num: "3", color: "bg-rose-500", textColor: "text-white", label: "QR Code imprime", time: "1 min" },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-xs font-bold ${s.textColor}`}>{s.num}</span>
                    </div>
                    <div className="flex-1 h-8 rounded-lg bg-white shadow-sm flex items-center px-3">
                      <span className="text-[9px] text-foreground font-semibold">{s.label}</span>
                      <span className="text-[8px] text-green-600 ml-auto font-semibold">{s.time}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">&#10003;</span>
                  </div>
                  <div className="flex-1 h-8 rounded-lg bg-green-50 border border-green-200 shadow-sm flex items-center px-3">
                    <span className="text-[9px] text-green-700 font-bold">Operationnel !</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className="text-xs font-bold text-yellow-hover bg-foreground rounded-full px-3 py-1 self-start mb-3">
                5 min chrono
              </span>
              <h3 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                Operationnel le jour meme
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-maison-neue)" }}>
                Inscription, personnalisation, QR code&nbsp;: vous imprimez votre affiche et
                vous tamponnez votre premier client le jour meme. Zero connaissance technique.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
