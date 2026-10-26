/**
 * Coordonnées commerciales — prise de rendez-vous avec un conseiller
 * (vente terrain : installation de la carte en boutique).
 */

export const CONTACT_EMAIL = "contact@aswallet.fr";

/** Numéro WhatsApp au format wa.me : indicatif pays, sans "+" ni espaces. */
export const WHATSAPP_NUMBER = "33782214993";

export function whatsappHref(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function emailHref(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
