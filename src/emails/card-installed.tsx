import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type CardInstalledEmailProps = {
  cardName: string;
  totalClients: number;
  dashboardUrl: string;
};

export function CardInstalledEmail({
  cardName,
  totalClients,
  dashboardUrl,
}: CardInstalledEmailProps) {
  return (
    <EmailLayout
      preview={`Un nouveau client vient d'installer votre carte « ${cardName} »`}
    >
      <Heading style={styles.headingStyle}>Nouveau client fidèle</Heading>
      <Text style={styles.paragraph}>
        Un nouveau client vient d&apos;installer votre carte
        {" "}
        <strong>« {cardName} »</strong>.
      </Text>
      <Text style={styles.paragraph}>
        Vous avez maintenant <strong>{totalClients}</strong>{" "}
        {totalClients > 1 ? "clients" : "client"} sur cette carte.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={dashboardUrl} style={styles.button}>
          Voir mes clients
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default CardInstalledEmail;
