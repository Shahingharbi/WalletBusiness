"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface CameraScannerProps {
  onResult: (token: string) => void;
  paused?: boolean;
}

const REGION_ID = "fidpass-qr-region";

function extractToken(raw: string): string {
  const trimmed = raw.trim();
  // If it's a URL like .../c/xxx/status/yyy, take the last segment
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || trimmed;
    }
  } catch {
    // ignore
  }
  return trimmed;
}

export function CameraScanner({ onResult, paused = false }: CameraScannerProps) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const stop = async () => {
    const scanner = scannerRef.current as
      | { stop: () => Promise<void>; clear: () => void; isScanning?: boolean }
      | null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        // ignore
      }
    }
    scannerRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode;
      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            const min = Math.min(vw, vh);
            const size = Math.floor(min * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decoded: string) => {
          const token = extractToken(decoded);
          const now = Date.now();
          const last = lastScanRef.current;
          // Debounce identical reads within 2s
          if (last && last.token === token && now - last.at < 2000) return;
          lastScanRef.current = { token, at: now };
          onResult(token);
        },
        () => {
          // ignore per-frame decode errors
        }
      );
      setActive(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d'acceder a la camera";
      setError(message);
      setActive(false);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  useEffect(() => {
    if (paused && active) void stop();
  }, [paused, active]);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-black border border-gray-700">
        <div id={REGION_ID} className="w-full h-full" />

        {!active && !starting && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 flex flex-col items-center justify-center text-white cursor-pointer hover:bg-white/5 transition-colors"
          >
            <Camera className="h-12 w-12 mb-3 text-gray-300" />
            <span className="text-sm font-medium">Activer la camera</span>
            <span className="text-xs text-gray-400 mt-1">
              Autorisez l&apos;acces a la camera
            </span>
          </button>
        )}

        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <Loader2 className="h-10 w-10 animate-spin mb-2" />
            <span className="text-sm">Demarrage...</span>
          </div>
        )}

        {active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-3/4 border-2 border-white/70 rounded-2xl" />
          </div>
        )}
      </div>

      {active && (
        <button
          type="button"
          onClick={() => void stop()}
          className="mx-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <CameraOff className="h-4 w-4" />
          Desactiver la camera
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
