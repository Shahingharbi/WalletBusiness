"use client";

import { useState } from "react";
import { Cake, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Props {
  clientId: string;
  initialBirthday: string | null;
}

function formatBirthday(iso: string): string {
  // YYYY-MM-DD -> "20 mars".
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function BirthdayEditor({ clientId, initialBirthday }: Props) {
  const toast = useToast();
  const [value, setValue] = useState<string>(initialBirthday ?? "");
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthday: value || null }),
      });
      const data = (await res.json()) as { client?: { birthday: string | null }; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setValue(data.client?.birthday ?? "");
      setEditing(false);
      toast.success("Anniversaire enregistré");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Cake className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 px-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={saving}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 cursor-pointer"
          aria-label="Enregistrer"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(initialBirthday ?? "");
            setEditing(false);
          }}
          disabled={saving}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-50 cursor-pointer"
          aria-label="Annuler"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 text-gray-700 hover:text-gray-900 group cursor-pointer"
    >
      <Cake className="h-4 w-4 text-gray-400 shrink-0" />
      {value ? (
        <span>{formatBirthday(value)}</span>
      ) : (
        <span className="text-gray-400 italic">Anniversaire non renseigné</span>
      )}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
    </button>
  );
}
