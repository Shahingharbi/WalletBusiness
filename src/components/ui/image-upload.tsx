"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: "card-assets" | "business-assets";
  folder?: string;
  hint?: string;
  aspect?: "square" | "wide";
}

export function ImageUpload({
  label,
  value,
  onChange,
  bucket = "card-assets",
  folder = "uploads",
  hint = "PNG, JPG, WEBP (max 3 Mo)",
  aspect = "square",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", bucket);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echec de l'upload");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const heightClass = aspect === "wide" ? "h-32" : "h-40";

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {value ? (
        <div className="relative group">
          <div
            className={`relative ${heightClass} w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden`}
          >
            <Image
              src={value}
              alt={label}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-contain"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
            aria-label="Supprimer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex ${heightClass} items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors duration-150`}
        >
          <div className="text-center">
            {uploading ? (
              <Loader2 className="mx-auto h-7 w-7 text-gray-400 animate-spin" />
            ) : (
              <Upload className="mx-auto h-7 w-7 text-gray-400" />
            )}
            <p className="mt-2 text-sm text-gray-500">
              {uploading ? "Envoi en cours..." : "Cliquez ou glissez un fichier"}
            </p>
            <p className="mt-1 text-xs text-gray-400">{hint}</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={onInputChange}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
