"use client";

import { useState } from "react";
import { Copy, ExternalLink, Share2, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface ShareCardProps {
  qrDataUrl: string;
  cardPublicUrl: string;
  cardName: string;
}

function shortenUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname;
    if (path.length > 12) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length > 0) {
        const last = parts[parts.length - 1];
        const shortTail = last.length > 10 ? `${last.slice(0, 4)}…${last.slice(-4)}` : last;
        const prefix = parts.slice(0, -1).join("/");
        return `${host}/${prefix ? prefix + "/" : ""}${shortTail}`;
      }
    }
    return `${host}${path}`;
  } catch {
    return url;
  }
}

export function ShareCard({ qrDataUrl, cardPublicUrl, cardName }: ShareCardProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardPublicUrl);
      setCopied(true);
      toast.success("Lien copie dans le presse-papier");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const handleShare = async () => {
    const data = {
      title: cardName,
      text: `Ajoutez ${cardName} a votre wallet`,
      url: cardPublicUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const display = shortenUrl(cardPublicUrl);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {qrDataUrl ? (
            <div className="shrink-0">
              <img
                src={qrDataUrl}
                alt="QR Code"
                width={160}
                height={160}
                className="rounded-lg border border-gray-200"
              />
            </div>
          ) : (
            <div className="shrink-0 h-40 w-40 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
              <QrCode className="h-10 w-10 text-gray-300" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-4 w-full">
            <div>
              <h3 className="font-semibold text-gray-900">
                Partagez votre carte
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Affichez ce QR code en boutique ou partagez le lien d&apos;installation.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex-1 min-w-0 px-3 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                  Lien d&apos;installation
                </p>
                <p
                  className="text-xs text-gray-700 font-mono truncate"
                  title={cardPublicUrl}
                >
                  {display}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="self-stretch px-3 border-l border-gray-200 hover:bg-white transition-colors flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer"
                aria-label="Copier le lien"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="hidden sm:inline text-emerald-700">Copie</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copier</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleShare}
                className="gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
              <a
                href={cardPublicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
