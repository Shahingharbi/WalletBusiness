"use client";

import { useEffect } from "react";
import Link from "next/link";
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
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-6xl font-bold text-gray-300">500</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-gray-500">
          Nous avons rencontre un probleme inattendu. Nos equipes ont ete
          averties. Vous pouvez revenir a l&apos;accueil ou reessayer dans un
          instant.
        </p>
        {error.digest ? (
          <p className="text-xs text-gray-400">Reference : {error.digest}</p>
        ) : null}
        <div className="pt-2">
          <Link href="/">
            <Button>Retour a l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
