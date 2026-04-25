"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    // Surface the error in logs; production will only have the digest.
    console.error(error);
    // Report to Sentry. No-op when DSN is not configured.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-6xl font-bold text-gray-300">500</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-gray-500">
          Nous avons rencontré un problème inattendu. Nos équipes ont été
          averties. Vous pouvez revenir à l&apos;accueil ou réessayer dans un
          instant.
        </p>
        {error.digest ? (
          <p className="text-xs text-gray-400">Référence : {error.digest}</p>
        ) : null}
        <div className="pt-2">
          <Link href="/">
            <Button>Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
