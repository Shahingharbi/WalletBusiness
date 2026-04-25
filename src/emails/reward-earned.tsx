import * as React from "react";
import {
  Button,
  EmailLayout,
  Heading,
  Section,
  Text,
  styles,
} from "./components";

export type RewardEarnedEmailProps = {
  firstName?: string;
  rewardText: string;
  businessName: string;
  walletUrl: string;
};

export function RewardEarnedEmail({
  firstName,
  rewardText,
  businessName,
  walletUrl,
}: RewardEarnedEmailProps) {
  return (
    <EmailLayout
      preview={`Bravo ! Vous venez de gagner ${rewardText} chez ${businessName}.`}
    >
      <Heading style={styles.headingStyle}>
        Bravo {firstName ?? ""} !
      </Heading>
      <Text style={styles.paragraph}>
        Vous venez de gagner <strong>{rewardText}</strong> chez{" "}
        <strong>{businessName}</strong>.
      </Text>
      <Text style={styles.paragraph}>
        Présentez votre carte lors de votre prochaine visite pour récupérer
        votre récompense.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={walletUrl} style={styles.button}>
          Voir ma carte
        </Button>
      </Section>
    </EmailLayout>
  );
}

export default RewardEarnedEmail;
