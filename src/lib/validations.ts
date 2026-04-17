import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caracteres"),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, "Le prenom est requis").max(50),
  lastName: z.string().min(1, "Le nom est requis").max(50),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caracteres"),
  businessName: z.string().min(1, "Le nom du commerce est requis").max(100),
});

export const cardSettingsSchema = z.object({
  name: z.string().min(1, "Le nom de la carte est requis").max(100),
  stampCount: z.number().int().min(1).max(30),
  rewardText: z.string().min(1, "La recompense est requise").max(200),
  barcodeType: z.enum(["qr", "pdf417"]),
  expirationType: z.enum(["unlimited", "fixed_date", "days_after_install"]),
  expirationDate: z.string().optional(),
  expirationDays: z.number().int().min(1).optional(),
});

export const cardDesignSchema = z.object({
  background_color: z.string(),
  text_color: z.string(),
  accent_color: z.string(),
  label_stamps: z.string().max(50),
  label_rewards: z.string().max(50),
  stamp_active_icon: z.string(),
  stamp_inactive_icon: z.string(),
});

export const businessProfileSchema = z.object({
  name: z.string().min(1, "Le nom du commerce est requis").max(100),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(10).optional(),
  phone: z.string().max(20).optional(),
  category: z.string().optional(),
});

export const invitationSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CardSettingsInput = z.infer<typeof cardSettingsSchema>;
export type CardDesignInput = z.infer<typeof cardDesignSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
