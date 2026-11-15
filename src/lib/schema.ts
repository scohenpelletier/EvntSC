import { z } from "zod";

/**
 * Plan document schema. Every field the organizer may not know yet is
 * nullable or has an explicit "unknown" value — missing details never block
 * saving a draft.
 */

export const CAMPUS_TIMEZONE = "America/Los_Angeles";

const short = (max: number) => z.string().max(max);
export const triState = z.enum(["yes", "no", "unknown"]);
export type TriState = z.infer<typeof triState>;

export const eventTypes = ["networking", "workshop", "info_session", "other"] as const;
export const venueStatuses = ["not_started", "requested", "confirmed", "unknown"] as const;
export const venueTypes = ["classroom", "event_space", "outdoor", "other", "unknown"] as const;
export const recognitionStatuses = ["recognized", "not_recognized", "unknown"] as const;
export const vendorStatuses = ["none_needed", "not_contacted", "quote_requested", "booked", "unknown"] as const;

export const intakeSchema = z.object({
  title: short(160),
  description: short(4000),
  eventType: z.enum(eventTypes),
  organizerName: short(120),
  organization: short(160),
  /** ISO calendar date YYYY-MM-DD in the campus timezone. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** True when the organizer has confirmed the date (AI-read dates start unconfirmed). */
  dateConfirmed: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timezone: z.literal(CAMPUS_TIMEZONE),
  /** Choice for a wall-clock time that occurs twice on a DST fall-back day. */
  dstChoice: z.enum(["earlier", "later"]).nullable(),
  attendance: z.number().int().positive().max(100000).nullable(),
  venueName: short(160),
  venueType: z.enum(venueTypes),
  venueStatus: z.enum(venueStatuses),
  recognition: z.enum(recognitionStatuses),
  food: triState,
  outsideSpeakers: triState,
  /** Celebrity / political leader / dignitary — triggers a TES-cited approval. */
  highProfileGuest: triState,
  vendors: triState,
  vendorStatus: z.enum(vendorStatuses),
  fundraising: triState,
  /** Fields added for the event planner. Defaults keep older saved plans valid. */
  purpose: short(300).default(""),
  /** The organizer's own words for a date that isn't a specific day yet ("next month"). */
  dateText: short(120).default(""),
  /** Outside guests such as alumni or employers (separate from student attendance). */
  guestCount: z.number().int().nonnegative().max(10000).nullable().default(null),
  accessibility: triState.default("unknown"),
  accessibilityNotes: short(1000).default(""),
  /** Set by "Plan something like this" on Discover: the published event this plan was modelled on (credited). */
  inspiredBy: z.object({ listingId: short(64), title: short(160), organizer: short(160) }).nullable().default(null),
  /** Money fields are kept as the organizer typed them and parsed by lib/money. */
  budgetTarget: short(20),
  fundingRequested: short(20),
  fundingConfirmed: short(20),
  notes: short(4000),
});
export type Intake = z.infer<typeof intakeSchema>;

export const budgetCategories = ["venue", "food", "speaker", "supplies", "marketing", "av", "other"] as const;
export const budgetLineSchema = z.object({
  id: short(64),
  description: short(160),
  category: z.enum(budgetCategories),
  quantity: short(20),
  unitCost: short(20),
  costUnknown: z.boolean(),
  /** Where a known figure came from: the organizer's estimate or a written quote. */
  costType: z.enum(["estimate", "quote"]).default("estimate"),
  notes: short(500),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

/**
 * Persisted organizer state for a task. Derived tasks are recomputed from the
 * intake on every change; only what the organizer did is stored here, keyed by
 * the task's stable ID, so recomputation never erases progress.
 */
export const taskStateSchema = z.object({
  id: short(120),
  /** Title at the time the organizer last touched it (kept if the task stops applying). */
  label: short(200),
  status: z.enum(["open", "in_progress", "done"]),
  /** Values of the task's dependencies at the moment it was completed. */
  doneSnapshot: z.record(z.string(), z.string()).nullable(),
  notes: short(2000),
  /** Organizer-selected target date (YYYY-MM-DD), always labeled as such. */
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** Only for organizer-created tasks. */
  custom: z
    .object({ title: short(200), detail: short(1000) })
    .nullable(),
  updatedAt: short(40),
});
export type TaskState = z.infer<typeof taskStateSchema>;

export const questionSchema = z.object({
  id: short(64),
  text: short(500),
  resolved: z.boolean(),
  answer: short(1000),
});
export type OpenQuestion = z.infer<typeof questionSchema>;

export const aiNoteSchema = z.object({
  ruleId: short(80),
  text: short(1200),
  createdAt: short(40),
});
export type AiNote = z.infer<typeof aiNoteSchema>;

/** Something the plan assumes but the organizer hasn't confirmed (e.g. "Alumni are unpaid guests"). */
export const assumptionSchema = z.object({ id: short(64), text: short(300), source: z.enum(["ai", "organizer", "demo"]) });
export type Assumption = z.infer<typeof assumptionSchema>;

export const draftKinds = ["venue", "catering", "guest_invite", "campus_question", "general"] as const;
export const draftSchema = z.object({
  id: short(64),
  kind: z.enum(draftKinds),
  /** Resource the draft is addressed to (from the resource dataset), if any. */
  resourceId: short(80).nullable(),
  taskId: short(120).nullable(),
  to: short(200),
  subject: short(200),
  body: short(6000),
  /** template = filled by code; ai = written by the model; demo = fixture in demo mode. */
  source: z.enum(["template", "ai", "demo"]),
  createdAt: short(40),
  updatedAt: short(40),
});
export type Draft = z.infer<typeof draftSchema>;

export const changeEntrySchema = z.object({
  id: short(64),
  at: short(40),
  /** What the organizer said or did ("Attendance increased from 60 to 100"). */
  request: short(500),
  fieldChanges: z.array(z.object({ field: short(60), before: short(200), after: short(200) })).max(30),
  added: z.array(short(200)).max(50),
  review: z.array(z.object({ title: short(200), reason: short(400) })).max(50),
  removed: z.array(short(200)).max(50),
  budgetNotes: z.array(short(300)).max(20),
  aiExplanation: short(1000).nullable(),
});
export type ChangeEntry = z.infer<typeof changeEntrySchema>;

export const planDocSchema = z.object({
  intake: intakeSchema,
  budget: z.array(budgetLineSchema).max(100),
  tasks: z.array(taskStateSchema).max(300),
  questions: z.array(questionSchema).max(100),
  aiNotes: z.array(aiNoteSchema).max(60),
  assumptions: z.array(assumptionSchema).max(30).default([]),
  drafts: z.array(draftSchema).max(40).default([]),
  changeLog: z.array(changeEntrySchema).max(50).default([]),
});
export type PlanDoc = z.infer<typeof planDocSchema>;

export function emptyIntake(): Intake {
  return {
    title: "",
    description: "",
    eventType: "workshop",
    organizerName: "",
    organization: "",
    date: null,
    dateConfirmed: true,
    startTime: null,
    endTime: null,
    timezone: CAMPUS_TIMEZONE,
    dstChoice: null,
    attendance: null,
    venueName: "",
    venueType: "unknown",
    venueStatus: "unknown",
    recognition: "unknown",
    food: "unknown",
    outsideSpeakers: "unknown",
    highProfileGuest: "unknown",
    vendors: "unknown",
    vendorStatus: "unknown",
    fundraising: "unknown",
    purpose: "",
    dateText: "",
    guestCount: null,
    accessibility: "unknown",
    accessibilityNotes: "",
    inspiredBy: null,
    budgetTarget: "",
    fundingRequested: "",
    fundingConfirmed: "",
    notes: "",
  };
}

export function emptyDoc(): PlanDoc {
  return { intake: emptyIntake(), budget: [], tasks: [], questions: [], aiNotes: [], assumptions: [], drafts: [], changeLog: [] };
}

export function newId(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + raw;
}

export const LABELS = {
  eventType: { networking: "Networking event", workshop: "Workshop", info_session: "Information session", other: "Other (limited guidance)" },
  venueStatus: { not_started: "Not requested yet", requested: "Requested, not confirmed", confirmed: "Confirmed", unknown: "Unknown" },
  venueType: { classroom: "Classroom", event_space: "Event space (TES-managed)", outdoor: "Outdoor venue", other: "Other", unknown: "Unknown" },
  recognition: { recognized: "Recognized (organizer-reported)", not_recognized: "Not recognized", unknown: "Unknown" },
  vendorStatus: { none_needed: "None needed", not_contacted: "Not contacted", quote_requested: "Quote requested", booked: "Booked (organizer-reported)", unknown: "Unknown" },
  tri: { yes: "Yes", no: "No", unknown: "Unknown" },
  costType: { estimate: "Estimate", quote: "Written quote" },
  draftKind: { venue: "Venue inquiry", catering: "Catering quote request", guest_invite: "Guest invitation", campus_question: "Campus process question", general: "General" },
  category: { venue: "Venue", food: "Food", speaker: "Speaker", supplies: "Supplies", marketing: "Marketing", av: "A/V", other: "Other" },
} as const;
