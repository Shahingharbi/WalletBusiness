"use client";

import { useCallback, useState } from "react";
import { MapPin, Plus, Trash2, Pencil, Search, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { PlanId } from "@/lib/billing";

export interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  relevant_text: string | null;
  is_active: boolean;
}

interface Props {
  initialLocations: LocationRow[];
  limit: number;
  plan: PlanId;
}

interface FormState {
  id: string | null;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  relevant_text: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  address: "",
  city: "",
  postal_code: "",
  latitude: "",
  longitude: "",
  relevant_text: "",
  is_active: true,
};

export function LocationsClient({ initialLocations, limit }: Props) {
  const toast = useToast();
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [geocoding, setGeocoding] = useState<boolean>(false);
  const [geocodeResults, setGeocodeResults] = useState<
    Array<{ latitude: number; longitude: number; display_name: string }>
  >([]);

  const reachedLimit = locations.length >= limit;

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setGeocodeResults([]);
    setEditing(true);
  };

  const startEdit = (loc: LocationRow) => {
    setForm({
      id: loc.id,
      name: loc.name,
      address: loc.address ?? "",
      city: loc.city ?? "",
      postal_code: loc.postal_code ?? "",
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      relevant_text: loc.relevant_text ?? "",
      is_active: loc.is_active,
    });
    setGeocodeResults([]);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setForm(EMPTY_FORM);
    setGeocodeResults([]);
  };

  const geocode = useCallback(async () => {
    const q = [form.address, form.postal_code, form.city]
      .filter((s) => s && s.trim())
      .join(", ");
    if (q.length < 3) {
      toast.error("Saisissez d'abord une adresse à géocoder");
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(
        `/api/locations/geocode?q=${encodeURIComponent(q)}`
      );
      const data = (await res.json()) as
        | { results: Array<{ latitude: number; longitude: number; display_name: string }> }
        | { error: string };
      if (!res.ok || "error" in data) {
        toast.error(("error" in data && data.error) || "Géocodage impossible");
        return;
      }
      if (data.results.length === 0) {
        toast.info("Aucun résultat. Précisez l'adresse ou saisissez les coordonnées manuellement.");
        return;
      }
      setGeocodeResults(data.results);
      // Auto-pick the first result.
      const first = data.results[0];
      setForm((f) => ({
        ...f,
        latitude: String(first.latitude),
        longitude: String(first.longitude),
      }));
      toast.success("Adresse trouvée — coordonnées remplies.");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setGeocoding(false);
    }
  }, [form.address, form.city, form.postal_code, toast]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nommez votre point de vente");
      return;
    }
    const lat = Number.parseFloat(form.latitude);
    const lng = Number.parseFloat(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Coordonnées GPS invalides");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        latitude: lat,
        longitude: lng,
        relevant_text: form.relevant_text.trim() || null,
        is_active: form.is_active,
      };
      const url = form.id ? `/api/locations/${form.id}` : "/api/locations";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | { location: LocationRow }
        | { error: string };
      if (!res.ok || "error" in data) {
        toast.error(("error" in data && data.error) || "Erreur");
        return;
      }
      const saved = data.location;
      setLocations((prev) => {
        if (form.id) {
          return prev.map((l) => (l.id === saved.id ? saved : l));
        }
        return [saved, ...prev];
      });
      toast.success(form.id ? "Localisation mise à jour" : "Localisation ajoutée");
      cancel();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce point de vente ?")) return;
    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Suppression impossible");
        return;
      }
      setLocations((prev) => prev.filter((l) => l.id !== id));
      toast.success("Localisation supprimée");
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const toggleActive = async (loc: LocationRow) => {
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !loc.is_active }),
      });
      const data = (await res.json()) as { location?: LocationRow; error?: string };
      if (!res.ok || !data.location) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setLocations((prev) =>
        prev.map((l) => (l.id === loc.id ? data.location! : l))
      );
    } catch {
      toast.error("Erreur réseau");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {locations.length === 0
            ? "Aucun point de vente pour l'instant."
            : `${locations.length} point${locations.length > 1 ? "s" : ""} de vente`}
        </p>
        {!editing && (
          <Button onClick={startCreate} disabled={reachedLimit}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        )}
      </div>

      {editing && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Nom du point de vente"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Boulangerie de la République"
                required
                maxLength={120}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Adresse"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="12 rue de la Paix"
                  maxLength={200}
                />
                <Input
                  label="Code postal"
                  value={form.postal_code}
                  onChange={(e) =>
                    setForm({ ...form, postal_code: e.target.value })
                  }
                  placeholder="75002"
                  maxLength={20}
                />
              </div>

              <Input
                label="Ville"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Paris"
                maxLength={80}
              />

              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={geocode}
                  loading={geocoding}
                  disabled={geocoding}
                >
                  <Search className="h-4 w-4 mr-1.5" />
                  Trouver les coordonnées GPS
                </Button>
                <p className="text-xs text-gray-500 mt-1.5">
                  Géocodage gratuit via OpenStreetMap.
                </p>
              </div>

              {geocodeResults.length > 1 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1">
                  {geocodeResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          latitude: String(r.latitude),
                          longitude: String(r.longitude),
                        })
                      }
                      className="w-full text-left text-xs text-gray-700 px-2 py-1.5 rounded hover:bg-white transition-colors"
                    >
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Latitude"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="48.8566"
                  inputMode="decimal"
                  required
                />
                <Input
                  label="Longitude"
                  value={form.longitude}
                  onChange={(e) =>
                    setForm({ ...form, longitude: e.target.value })
                  }
                  placeholder="2.3522"
                  inputMode="decimal"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="relevant_text"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Message de notification (optionnel)
                </label>
                <textarea
                  id="relevant_text"
                  value={form.relevant_text}
                  onChange={(e) =>
                    setForm({ ...form, relevant_text: e.target.value })
                  }
                  maxLength={200}
                  rows={2}
                  placeholder="Ex: Bienvenue chez nous ! Présentez votre carte à la caisse."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Affiché en notification sur l&apos;écran verrouillé du client à
                  proximité (Apple Wallet).
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Actif (embarqué dans les pass wallet)
              </label>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <Button type="button" variant="secondary" onClick={cancel}>
                  Annuler
                </Button>
                <Button type="submit" loading={saving} disabled={saving}>
                  {form.id ? "Enregistrer" : "Ajouter"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!editing && reachedLimit && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          Vous avez atteint la limite de {limit} localisation{limit > 1 ? "s" : ""}{" "}
          de votre plan.
        </p>
      )}

      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-14 px-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-beige flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-foreground/70" />
            </div>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Ajoutez votre boutique pour activer la notification automatique
              quand un client passe devant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <Card key={loc.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-beige flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">
                        {loc.name}
                      </p>
                      {!loc.is_active && (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </div>
                    {(loc.address || loc.city) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[loc.address, loc.postal_code, loc.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(loc)}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                    title={loc.is_active ? "Désactiver" : "Activer"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(loc)}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(loc.id)}
                    className="p-2 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
