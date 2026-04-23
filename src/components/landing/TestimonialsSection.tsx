import { Quote } from "lucide-react";

/* TODO: remplacer par de vrais temoignages une fois onboarding des 10 premiers commercants */
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  city: string;
  avatarSeed: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "En 2 mois, 180 clients ont la carte dans leur telephone. Je leur envoie une offre le mardi midi, je double les couverts sur le service.",
    name: "Karim",
    role: "Kebab",
    city: "Lyon 3e",
    avatarSeed: "Karim",
  },
  {
    quote:
      "Les cartes papier, j'en imprimais 500 par mois et la moitie finissait a la poubelle. Avec aswallet, 0 impression et je vois qui revient.",
    name: "Amelie",
    role: "Boulangerie",
    city: "Lille",
    avatarSeed: "Amelie",
  },
  {
    quote:
      "Installe en 10 minutes entre deux rendez-vous. Mes clients scannent le QR code au comptoir, la carte est dans leur Apple Wallet, c'est tout.",
    name: "Mehdi",
    role: "Barber shop",
    city: "Marseille",
    avatarSeed: "Mehdi",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="testimonials">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold max-w-3xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Ils ont fait basculer leur fidelite
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Des commercants comme vous, qui ont arrete d&apos;imprimer des cartes papier.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-border bg-beige p-7 hover:shadow-lg transition-shadow"
            >
              <Quote size={24} className="text-yellow-hover" fill="currentColor" />
              <p
                className="mt-4 text-base text-foreground leading-relaxed flex-1"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                &laquo;&nbsp;{t.quote}&nbsp;&raquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(t.avatarSeed)}&backgroundColor=fff382,ffe94d,f9f7f0&fontFamily=Arial`}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  decoding="async"
                  className="h-11 w-11 rounded-full border border-border"
                />
                <div>
                  <p
                    className="text-sm font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    {t.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.role} &middot; {t.city}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
