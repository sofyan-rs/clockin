import { z } from 'zod';

/** PRD §9.6 defaults. Stored in companies.settings (jsonb); missing keys fall back to these. */
export const companySettingsSchema = z.object({
  clockIn: z
    .object({
      selfieAtClockOut: z.boolean().default(true),
      allowOfflineClockIn: z.boolean().default(true),
      offlineDriftReviewMin: z.number().int().min(1).default(5),
      blockFakeGps: z.boolean().default(true),
      allowWeakGps: z.boolean().default(true),
      correctionWindowWorkDays: z.number().int().min(0).default(3),
    })
    .prefault({}),
  privacy: z
    .object({
      selfieRetentionMonths: z
        .union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)])
        .default(3),
      locationRetentionMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]).default(12),
    })
    .prefault({}),
  mobileApp: z
    .object({
      minVersion: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .default('1.0.0'),
      biometricUnlock: z.boolean().default(true),
      /** null = never. */
      autoSignOutDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]).default(30),
    })
    .prefault({}),
  // PRD §5.1: Phase 2 entry points stay hidden until these are switched on.
  features: z
    .object({
      requests: z.boolean().default(false),
      notifications: z.boolean().default(false),
      holidays: z.boolean().default(false),
    })
    .prefault({}),
});

export type CompanySettings = z.infer<typeof companySettingsSchema>;

export function parseCompanySettings(raw: unknown): CompanySettings {
  return companySettingsSchema.parse(raw ?? {});
}
