"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Global error boundary — catches errors in the root layout itself.
 * Recommended by Sentry to capture root-layout failures.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#f9fafb",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>
            Une erreur est survenue
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
            Nos équipes ont été averties. Merci de réessayer dans un instant.
          </p>
        </div>
      </body>
    </html>
  );
}
