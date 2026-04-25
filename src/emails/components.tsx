import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

/**
 * Shared brand styling for transactional emails.
 *
 * Brand: yellow CTA button (#FFE94D), beige background (#f9f7f0),
 * dark text on light backgrounds for AAA contrast. Yellow is only used
 * on dark backgrounds when text appears on it.
 */
export const brand = {
  yellow: "#FFE94D",
  beige: "#f9f7f0",
  dark: "#0a0a0a",
  text: "#1f1f1f",
  muted: "#6b6b6b",
  border: "#e5e3da",
} as const;

const main: React.CSSProperties = {
  backgroundColor: brand.beige,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: `1px solid ${brand.border}`,
  borderRadius: 12,
  margin: "32px auto",
  maxWidth: 560,
  padding: "32px 28px",
};

const headingStyle: React.CSSProperties = {
  color: brand.dark,
  fontFamily:
    "'Ginto Nord', 'Maison Neue Extended', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 24,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
  margin: "0 0 16px 0",
};

const paragraph: React.CSSProperties = {
  color: brand.text,
  fontSize: 15,
  lineHeight: 1.55,
  margin: "0 0 16px 0",
};

const button: React.CSSProperties = {
  backgroundColor: brand.yellow,
  borderRadius: 999,
  color: brand.dark,
  display: "inline-block",
  fontSize: 15,
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const footerText: React.CSSProperties = {
  color: brand.muted,
  fontSize: 12,
  lineHeight: 1.5,
  margin: "0 0 4px 0",
  textAlign: "center" as const,
};

export type EmailLayoutProps = {
  preview: string;
  children: React.ReactNode;
  /** Optional unsubscribe link. */
  unsubscribeUrl?: string;
};

export function EmailLayout({ preview, children, unsubscribeUrl }: EmailLayoutProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text
              style={{
                color: brand.dark,
                fontFamily:
                  "'Ginto Nord', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.04em",
                margin: "0 0 24px 0",
                textTransform: "uppercase" as const,
              }}
            >
              aswallet
            </Text>
            {children}
          </Section>
          <Hr style={{ borderColor: brand.border, margin: "28px 0 16px 0" }} />
          <Text style={footerText}>
            aswallet — La carte de fidélité digitale pour commerces de
            proximité.
          </Text>
          <Text style={footerText}>
            <a href="https://aswallet.fr" style={{ color: brand.muted }}>
              aswallet.fr
            </a>
            {unsubscribeUrl ? (
              <>
                {" · "}
                <a href={unsubscribeUrl} style={{ color: brand.muted }}>
                  Se désinscrire
                </a>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = { headingStyle, paragraph, button };

export { Button, Heading, Section, Text };
