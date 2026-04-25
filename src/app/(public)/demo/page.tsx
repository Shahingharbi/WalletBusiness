import type { Metadata } from "next";
import { DemoPlayground } from "./demo-playground";

export const metadata: Metadata = {
  title: "Démo aswallet — testez votre carte de fidélité en 30 secondes",
  description:
    "Personnalisez votre carte de fidélité digitale en direct : nom, couleurs, secteur, nombre de tampons, récompense. Sans inscription.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return <DemoPlayground />;
}
