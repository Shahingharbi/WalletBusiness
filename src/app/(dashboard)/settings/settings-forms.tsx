"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { BUSINESS_CATEGORIES } from "@/lib/constants";

interface ProfileData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

interface BusinessData {
  name: string;
  category: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  logo_url: string | null;
}

interface SettingsFormsProps {
  profile: ProfileData;
  business: BusinessData;
  canEditBusiness: boolean;
}

export function SettingsForms({
  profile: initialProfile,
  business: initialBusiness,
  canEditBusiness,
}: SettingsFormsProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [business, setBusiness] = useState(initialBusiness);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [bizLoading, setBizLoading] = useState(false);
  const [bizMessage, setBizMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfileMessage({ type: "success", text: "Profil mis a jour" });
      router.refresh();
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const saveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizLoading(true);
    setBizMessage(null);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(business),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBizMessage({ type: "success", text: "Commerce mis a jour" });
      router.refresh();
    } catch (err) {
      setBizMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setBizLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mon profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Prenom"
                value={profile.first_name}
                onChange={(e) =>
                  setProfile({ ...profile, first_name: e.target.value })
                }
              />
              <Input
                label="Nom"
                value={profile.last_name}
                onChange={(e) =>
                  setProfile({ ...profile, last_name: e.target.value })
                }
              />
            </div>
            <Input label="Email" value={profile.email} disabled />
            <Input
              label="Telephone"
              value={profile.phone}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />

            {profileMessage && (
              <p
                className={`text-sm ${
                  profileMessage.type === "success"
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {profileMessage.text}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={profileLoading}>
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mon commerce</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveBusiness} className="space-y-4">
            {canEditBusiness ? (
              <ImageUpload
                label="Logo du commerce"
                value={business.logo_url}
                onChange={(url) => setBusiness({ ...business, logo_url: url })}
                bucket="business-assets"
                folder="logos"
                aspect="square"
              />
            ) : null}

            <Input
              label="Nom du commerce"
              value={business.name}
              onChange={(e) =>
                setBusiness({ ...business, name: e.target.value })
              }
              disabled={!canEditBusiness}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Categorie
              </label>
              <select
                value={business.category}
                onChange={(e) =>
                  setBusiness({ ...business, category: e.target.value })
                }
                disabled={!canEditBusiness}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="">Selectionnez une categorie</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Adresse"
              value={business.address}
              onChange={(e) =>
                setBusiness({ ...business, address: e.target.value })
              }
              disabled={!canEditBusiness}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ville"
                value={business.city}
                onChange={(e) =>
                  setBusiness({ ...business, city: e.target.value })
                }
                disabled={!canEditBusiness}
              />
              <Input
                label="Code postal"
                value={business.postal_code}
                onChange={(e) =>
                  setBusiness({ ...business, postal_code: e.target.value })
                }
                disabled={!canEditBusiness}
              />
            </div>
            <Input
              label="Telephone"
              value={business.phone}
              onChange={(e) =>
                setBusiness({ ...business, phone: e.target.value })
              }
              disabled={!canEditBusiness}
            />

            {bizMessage && (
              <p
                className={`text-sm ${
                  bizMessage.type === "success"
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {bizMessage.text}
              </p>
            )}

            {canEditBusiness && (
              <div className="flex justify-end">
                <Button type="submit" loading={bizLoading}>
                  Enregistrer
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}
