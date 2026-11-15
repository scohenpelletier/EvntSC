import { z } from "zod";

/**
 * Organizer preferences saved on the account (Supabase user metadata, like Discover interests).
 * They are stored only: EvntSC does not send reminder or update emails yet, and the UI says so.
 */
export const prefsSchema = z.object({
  /** Default organization filled into new plans. */
  organization: z.string().trim().max(120),
  /** Wants a reminder before organizer target dates (saved preference; no emails are sent yet). */
  reminders: z.boolean(),
  /** Wants a weekly summary of open checklist items (saved preference; no emails are sent yet). */
  emailUpdates: z.boolean(),
  /** Finished or skipped the first-run interests screen. */
  onboarded: z.boolean(),
});

export type Prefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: Prefs = { organization: "", reminders: false, emailUpdates: false, onboarded: false };

/** Reads prefs from untrusted user metadata, falling back field by field. */
export function parsePrefs(meta: unknown): Prefs {
  const m = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const pick = <K extends keyof Prefs>(k: K): Prefs[K] => {
    const r = prefsSchema.shape[k].safeParse(m[k]);
    return (r.success ? r.data : DEFAULT_PREFS[k]) as Prefs[K];
  };
  return { organization: pick("organization"), reminders: pick("reminders"), emailUpdates: pick("emailUpdates"), onboarded: pick("onboarded") };
}

/** Partial update accepted by PUT /api/settings/prefs. */
export const prefsPatchSchema = prefsSchema.partial().strict();
