"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Trash2, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Invitation {
  id: string;
  email: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface InvitationsManagerProps {
  invitations: Invitation[];
  employees: Employee[];
}

export function InvitationsManager({
  invitations,
  employees,
}: InvitationsManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoquer cette invitation ?")) return;
    try {
      const res = await fetch(`/api/invitations?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      // ignore
    }
  };

  const copyLink = async (token: string) => {
    const link = `${appUrl}/invitation/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employes & invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Input
                label="Inviter un employe"
                type="email"
                placeholder="employe@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              <Mail className="h-4 w-4 mr-1.5" />
              Inviter
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">
            L&apos;invitation genere un lien a partager (pas d&apos;email envoye).
          </p>
        </form>

        {pending.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">
              Invitations en attente
            </h3>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {pending.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between p-3 gap-2"
                >
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Expire le{" "}
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge variant="warning">En attente</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyLink(inv.token)}
                  >
                    {copied === inv.token ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Copie
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Lien
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    className="text-gray-400 hover:text-red-600 p-2 rounded transition-colors cursor-pointer"
                    aria-label="Revoquer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {employees.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">
              Employes actifs ({employees.length})
            </h3>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {employees.map((emp) => (
                <div key={emp.id} className="p-3 text-sm text-gray-900">
                  {emp.first_name} {emp.last_name}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
