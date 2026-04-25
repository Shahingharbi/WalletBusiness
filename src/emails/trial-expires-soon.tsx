import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type TrialExpiresSoonEmailProps = {
  daysLeft: number;
  pricingUrl: string;
};

export function TrialExpiresSoonEmail({
  daysLeft,
  pricingUrl,
}: TrialExpiresSoonEmailProps) {
  return (
    <EmailLayout
      preview={`Votre essai gratuit expire dans ${daysLeft} jours.`}
    >
      <Heading style={styles.headingStyle}>
        Votre essai gratuit expire bientôt
      </Heading>
      <Text style={styles.paragraph}>
        Plus que <strong>{daysLeft} jours</strong> avant la fin de votre
        période d&apos;essai gratuite.
      </Text>
      <Text style={styles.paragraph}>
        Pour continuer à recevoir des installations de cartes, à scanner vos
        clients et à fidéliser votre commerce, choisissez un plan adapté à
        votre activité.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={pricingUrl} style={styles.button}>
          Choisir mon plan
        </Button>
      </Section>
      <Text style={{ ...styles.paragraph, color: "#6b6b6b", fontSize: 13 }}>
        Une question sur les plans ? Répondez à cet email, on vous
        accompagne.
      </Text>
    </EmailLayout>
  );
}

export default TrialExpiresSoonEmail;
