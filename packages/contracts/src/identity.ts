import { z } from "zod";

export const internalAccountStatusSchema = z.enum([
  "pending_onboarding",
  "active",
  "suspended",
  "deletion_requested",
  "deletion_pending",
  "deleted",
]);

export const profileFieldVisibilitySchema = z.enum(["public", "workspace", "private"]);

export const userProfileSchema = z.object({
  handle: z.string().min(3).max(40).nullable(),
  displayName: z.string().max(200),
  preferredName: z.string().max(200).nullable(),
  legalName: z.string().max(300).nullable(),
  pronouns: z.string().max(100).nullable(),
  avatarAssetId: z.string().max(200).nullable(),
  institutionAffiliation: z.string().max(300).nullable(),
  locale: z.string().min(2).max(35),
  timezone: z.string().min(1).max(100),
  fieldVisibility: z.record(z.string(), profileFieldVisibilitySchema),
  version: z.number().int().positive(),
});

export const userPreferencesSchema = z.object({
  locale: z.string().min(2).max(35),
  timezone: z.string().min(1).max(100),
  theme: z.enum(["system", "light", "dark"]),
  density: z.enum(["comfortable", "compact"]),
  notificationSettings: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
});

export const onboardingStateSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "skipped"]),
  currentStep: z.string().max(100).nullable(),
  personas: z.array(z.string().min(1).max(100)).max(20),
  interests: z.array(z.string().min(1).max(100)).max(50),
  completedAt: z.coerce.date().nullable(),
});

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  status: internalAccountStatusSchema,
  version: z.number().int().positive(),
  profile: userProfileSchema,
  preferences: userPreferencesSchema,
  onboarding: onboardingStateSchema,
});

export const patchProfileRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    displayName: z.string().trim().min(1).max(200).optional(),
    preferredName: z.string().trim().max(200).nullable().optional(),
    legalName: z.string().trim().max(300).nullable().optional(),
    pronouns: z.string().trim().max(100).nullable().optional(),
    institutionAffiliation: z.string().trim().max(300).nullable().optional(),
    locale: z.string().trim().min(2).max(35).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some((key) => key !== "expectedVersion"),
    { message: "At least one profile field must be supplied." },
  );

export const patchPreferencesRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    locale: z.string().trim().min(2).max(35).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    density: z.enum(["comfortable", "compact"]).optional(),
    notificationSettings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some((key) => key !== "expectedVersion"),
    { message: "At least one preference field must be supplied." },
  );

export const completeOnboardingRequestSchema = z.object({
  skipped: z.boolean().default(false),
  personas: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  interests: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
});

export const accountDeletionRequestSchema = z.object({
  reasonCategory: z.string().trim().min(1).max(100).optional(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
export type PatchProfileRequest = z.infer<typeof patchProfileRequestSchema>;
export type PatchPreferencesRequest = z.infer<typeof patchPreferencesRequestSchema>;
export type CompleteOnboardingRequest = z.infer<typeof completeOnboardingRequestSchema>;
