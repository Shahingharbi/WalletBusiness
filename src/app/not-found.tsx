import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h1 className="text-2xl font-bold text-gray-900">Page introuvable</h1>
        <p className="text-sm text-gray-500">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link href="/">
          <Button>Retour à l&apos;accueil</Button>
        </Link>
      </div>
    </div>
  );
}
