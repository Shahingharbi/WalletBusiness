"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CameraScanner } from "@/components/scanner/camera-scanner";
import { Confetti } from "@/components/scanner/confetti";

interface ScanResult {
  success: boolean;
  client_name: string;
  stamps_collected: number;
  max_stamps: number;
  rewards_available: number;
  reward_text: string;
  card_instance_id: string;
  reward_earned: boolean;
}

type Step = "scan" | "choose" | "result";

const QUICK_OPTIONS = [1, 2, 3, 5, 10];
const MAX_STAMPS = 20;

export default function ScannerPage() {
  const [step, setStep] = useState<Step>("scan");
  const [token, setToken] = useState("");
  const [stamps, setStamps] = useState(1);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [mode, setMode] = useState<"camera" | "manual">("camera");

  const captureToken = useCallback((rawToken: string) => {
    const t = rawToken.trim();
    if (!t) return;
    setToken(t);
    setStamps(1);
    setError(null);
    setStep("choose");
  }, []);

  async function submitScan() {
    if (!token || stamps < 1) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, stamps }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors du scan");
        return;
      }

      setResult(data);
      setStep("result");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem() {
    if (!result) return;

    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_instance_id: result.card_instance_id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'utilisation de la récompense");
        return;
      }

      setRedeemSuccess(true);
      setResult((prev) =>
        prev
          ? { ...prev, rewards_available: prev.rewards_available - 1 }
          : null
      );
    } catch {
      setError("Erreur de connexion");
    } finally {
      setRedeeming(false);
    }
  }

  function handleReset() {
    setToken("");
    setStamps(1);
    setResult(null);
    setError(null);
    setRedeemSuccess(false);
    setStep("scan");
  }

  function adjustStamps(delta: number) {
    setStamps((s) => Math.min(MAX_STAMPS, Math.max(1, s + delta)));
  }

  return (
    <div className="flex-1 flex flex-col p-4">
      {step === "scan" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h1 className="text-white text-xl font-bold mb-1">Scanner un client</h1>
              <p className="text-gray-400 text-sm">
                {mode === "camera"
                  ? "Pointez la caméra sur le QR code"
                  : "Saisissez le code manuellement"}
              </p>
            </div>

            <div className="flex rounded-lg bg-gray-800 p-1 border border-gray-700">
              <button
                type="button"
                onClick={() => setMode("camera")}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors cursor-pointer ${
                  mode === "camera"
                    ? "bg-white text-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Caméra
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors cursor-pointer ${
                  mode === "manual"
                    ? "bg-white text-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Manuel
              </button>
            </div>

            {mode === "camera" ? (
              <CameraScanner paused={false} onResult={captureToken} />
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Code client (token)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && captureToken(token)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-center text-lg h-14"
                />
                <Button
                  onClick={() => captureToken(token)}
                  size="lg"
                  className="w-full text-base font-semibold h-14"
                >
                  Continuer
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3">
                <p className="text-sm text-red-300 text-center">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "choose" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h1 className="text-white text-2xl font-bold mb-1">
                Combien de tampons ?
              </h1>
              <p className="text-gray-400 text-sm">
                Choisissez le nombre à ajouter
              </p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => adjustStamps(-1)}
                  disabled={stamps <= 1}
                  className="h-14 w-14 rounded-full bg-gray-700 text-white text-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors cursor-pointer"
                  aria-label="Retirer un tampon"
                >
                  −
                </button>
                <div className="text-center min-w-[4rem]">
                  <div className="text-white text-5xl font-bold tabular-nums">
                    {stamps}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    tampon{stamps > 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => adjustStamps(1)}
                  disabled={stamps >= MAX_STAMPS}
                  className="h-14 w-14 rounded-full bg-gray-700 text-white text-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors cursor-pointer"
                  aria-label="Ajouter un tampon"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {QUICK_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStamps(n)}
                    className={`h-11 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      stamps === n
                        ? "bg-emerald-500 text-black"
                        : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={submitScan}
                loading={loading}
                size="lg"
                className="w-full text-base font-semibold h-14"
              >
                Valider {stamps} tampon{stamps > 1 ? "s" : ""}
              </Button>
              <Button
                onClick={handleReset}
                variant="secondary"
                size="lg"
                className="w-full text-base bg-gray-800 border-gray-700 text-white hover:bg-gray-700 h-14"
              >
                Annuler
              </Button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3">
                <p className="text-sm text-red-300 text-center">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {result.reward_earned && <Confetti count={50} />}
          <div className="w-full max-w-sm space-y-6 relative z-10">
            {result.reward_earned ? (
              <div className="text-center animate-celebrate">
                <div className="text-6xl mb-3">&#127881;</div>
                <h2 className="text-white text-2xl font-bold">Récompense gagnée !</h2>
                <p className="text-amber-400 text-sm mt-1">{result.reward_text}</p>
              </div>
            ) : (
              <div className="text-center animate-stamp-pop">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                  <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-white text-xl font-bold">
                  {stamps > 1 ? `${stamps} tampons ajoutés !` : "Tampon ajouté !"}
                </h2>
              </div>
            )}

            <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Client</span>
                <span className="text-white font-semibold">{result.client_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Tampons</span>
                <span className="text-white font-semibold">
                  {result.stamps_collected} / {result.max_stamps}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (result.stamps_collected / result.max_stamps) * 100)}%`,
                  }}
                />
              </div>
              {result.rewards_available > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Récompenses</span>
                  <span className="text-amber-400 font-bold">
                    {result.rewards_available} disponible{result.rewards_available > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {result.rewards_available > 0 && !redeemSuccess && (
              <Button
                onClick={handleRedeem}
                loading={redeeming}
                size="lg"
                className="w-full text-base font-semibold bg-amber-500 hover:bg-amber-600 text-black h-14"
              >
                Utiliser la récompense
              </Button>
            )}

            {redeemSuccess && (
              <div className="rounded-xl bg-emerald-900/30 border border-emerald-700 px-4 py-3 text-center">
                <p className="text-emerald-300 font-semibold">
                  Récompense utilisée avec succès !
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3">
                <p className="text-sm text-red-300 text-center">{error}</p>
              </div>
            )}

            <Button
              onClick={handleReset}
              variant="secondary"
              size="lg"
              className="w-full text-base bg-gray-800 border-gray-700 text-white hover:bg-gray-700 h-14"
            >
              Scanner suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
