import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type WelcomeEmailProps = {
  firstName?: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ firstName, dashboardUrl }: WelcomeEmailProps) {
  const greeting = firstName ? `Bienvenue ${firstName} !` : "Bienvenue !";
  return (
    <EmailLayout preview="Bienvenue chez aswallet — créez votre première carte en 5 minutes.">
      <Heading style={styles.headingStyle}>{greeting}</Heading>
      <Text style={styles.paragraph}>
        Ravis de vous compter parmi les commerces qui digitalisent leur
        fidélité avec aswallet.
      </Text>
      <Text style={styles.paragraph}>
        Voici comment créer votre première carte en 5 minutes :
      </Text>
      <Text style={styles.paragraph}>
        1. Choisissez un modèle de carte adapté à votre commerce.<br />
        2. Personnalisez les couleurs, le logo et la récompense.<br />
        3. Partagez le QR code à imprimer ou afficher en caisse.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={dashboardUrl} style={styles.button}>
          Créer ma première carte
        </Button>
      </Section>
      <Text style={styles.paragraph}>
        Une question ? Répondez simplement à cet email — nous lisons tout.
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;
