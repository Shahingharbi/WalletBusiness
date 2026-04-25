import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type PasswordResetEmailProps = {
  resetUrl: string;
};

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Réinitialisez votre mot de passe aswallet">
      <Heading style={styles.headingStyle}>
        Réinitialisez votre mot de passe
      </Heading>
      <Text style={styles.paragraph}>
        Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le
        bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire
        dans 60 minutes.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={styles.button}>
          Choisir un nouveau mot de passe
        </Button>
      </Section>
      <Text style={{ ...styles.paragraph, color: "#6b6b6b", fontSize: 13 }}>
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez
        simplement cet email — votre mot de passe restera inchangé.
      </Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;
