// Helpers RBAC partagés pour l'autorisation des actions de gestion business.
//
// Règle générale : un super_admin peut TOUT faire — il a vue + droits sur
// l'ensemble des business pour le support / debug. Sinon on respecte la
// hiérarchie business_owner > employee.

export type AppRole = "super_admin" | "business_owner" | "employee" | string | null | undefined;

/**
 * Vrai si le role peut effectuer les actions historiquement réservées au
 * propriétaire (activer une carte, modifier le commerce, gérer les invitations,
 * etc.). Inclut super_admin pour ne jamais bloquer l'admin global.
 */
export function isOwnerOrAdmin(role: AppRole): boolean {
  return role === "business_owner" || role === "super_admin";
}

/**
 * Vrai si le role peut scanner / valider une récompense (employés + owner +
 * super_admin).
 */
export function canScan(role: AppRole): boolean {
  return (
    role === "employee" ||
    role === "business_owner" ||
    role === "super_admin"
  );
}

/** Vrai si le role est super_admin uniquement. */
export function isSuperAdmin(role: AppRole): boolean {
  return role === "super_admin";
}
