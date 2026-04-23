import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInvitationForm } from "./accept-form";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, email, status, expires_at, business_id, businesses(name)")
    .eq("token", token)
    .single();

  if (!invitation) notFound();

  const businessName =
    (invitation.businesses as unknown as { name: string } | null)?.name ?? "ce commerce";

  if (invitation.status !== "pending") {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Invitation indisponible
        </h1>
        <p className="text-gray-500">
          Cette invitation a déjà été utilisée ou révoquée.
        </p>
      </div>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Invitation expirée</h1>
        <p className="text-gray-500">
          Demandez au propriétaire de vous renvoyer une invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Rejoindre {businessName}
        </h1>
        <p className="text-sm text-gray-500">
          Créez votre compte employé pour scanner les cartes des clients.
        </p>
      </div>

      <AcceptInvitationForm token={token} email={invitation.email} />
    </div>
  );
}
