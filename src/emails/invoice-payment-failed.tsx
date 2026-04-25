import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type InvoicePaymentFailedEmailProps = {
  amount: string;
  updatePaymentUrl: string;
};

export function InvoicePaymentFailedEmail({
  amount,
  updatePaymentUrl,
}: InvoicePaymentFailedEmailProps) {
  return (
    <EmailLayout preview="Le paiement de votre facture aswallet a échoué">
      <Heading style={styles.headingStyle}>Paiement échoué</Heading>
      <Text style={styles.paragraph}>
        Nous n&apos;avons pas pu prélever <strong>{amount}</strong> sur votre
        moyen de paiement enregistré.
      </Text>
      <Text style={styles.paragraph}>
        Pour éviter toute interruption de service, merci de mettre à jour vos
        informations de paiement dès que possible.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={updatePaymentUrl} style={styles.button}>
          Mettre à jour le paiement
        </Button>
      </Section>
      <Text style={{ ...styles.paragraph, color: "#6b6b6b", fontSize: 13 }}>
        Stripe va automatiquement réessayer le prélèvement dans les jours qui
        viennent.
      </Text>
    </EmailLayout>
  );
}

export default InvoicePaymentFailedEmail;
