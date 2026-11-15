import { z } from "zod";
import { checkSchedule } from "../dates";
import type { Intake } from "../schema";

/**
 * TroyLens (optional extension): a public event card built from a plan.
 *
 * Only these fields ever leave the private plan. The title, organizer, date,
 * time, and location come from the SAVED plan; the organizer writes the public
 * description and picks the tags explicitly when publishing.
 */

export const troyLensEnabled = () => process.env.NEXT_PUBLIC_ENABLE_TROYLENS === "true";

export const INTEREST_TAGS = [
  { id: "tech", label: "Tech" },
  { id: "career", label: "Career" },
  { id: "entrepreneurship", label: "Entrepreneurship" },
  { id: "design", label: "Design" },
  { id: "science", label: "Science" },
  { id: "health", label: "Health" },
  { id: "arts", label: "Arts" },
  { id: "social_impact", label: "Social impact" },
  { id: "culture", label: "Culture" },
  { id: "academic", label: "Academic" },
] as const;
export type InterestTag = (typeof INTEREST_TAGS)[number]["id"];
export const TAG_IDS = INTEREST_TAGS.map((t) => t.id) as [InterestTag, ...InterestTag[]];
export const tagLabel = (id: string) => INTEREST_TAGS.find((t) => t.id === id)?.label ?? id;
export const MAX_TAGS = 5;
export const MAX_DESCRIPTION = 1000;

/** What the organizer submits when publishing. Everything else is taken from the saved plan. */
export const publishBodySchema = z.object({
  planVersion: z.number().int().positive(),
  description: z.string().max(MAX_DESCRIPTION),
  tags: z.array(z.enum(TAG_IDS)).max(MAX_TAGS),
});
export type PublishBody = z.infer<typeof publishBodySchema>;

export type CardFields = {
  title: string;
  organizer: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  locationStatus: "confirmed" | "tba";
};

export type Listing = CardFields & {
  id: string;
  description: string;
  tags: InterestTag[];
  isSample: boolean;
  planVersion: number;
  publishedAt: string;
  updatedAt: string;
};

export type CardNote = { level: "blocker" | "info"; text: string };

/**
 * Derives the shareable fields from a plan's intake. Unconfirmed details are
 * withheld (shown as "to be announced") rather than published as if settled.
 */
export function cardFromIntake(intake: Intake): { fields: CardFields; notes: CardNote[] } {
  const notes: CardNote[] = [];
  const title = intake.title.trim().slice(0, 160);
  if (!title) notes.push({ level: "blocker", text: "Add an event title before publishing." });

  const org = intake.organization.trim();
  const person = intake.organizerName.trim();
  const organizer = (org || person).slice(0, 160);
  if (!org && person) notes.push({ level: "info", text: "No organization is set, so your organizer name will be shown publicly." });
  if (!organizer) notes.push({ level: "info", text: "No organization or organizer name is set; the card won't name an organizer." });

  let date: string | null = null;
  if (intake.date && intake.dateConfirmed) date = intake.date;
  else if (intake.date) notes.push({ level: "info", text: "The event date isn't confirmed yet, so the card will say “Date to be announced”." });
  else notes.push({ level: "info", text: "No event date yet — the card will say “Date to be announced”." });

  const startTime = date ? intake.startTime : null;
  const endTime = date && intake.startTime ? intake.endTime : null;
  if (date) {
    // Same validator the plan form uses: end after start, no spring-forward times, a chosen occurrence for fall-back times.
    const sched = checkSchedule({ ...intake, startTime, endTime });
    const timeProblems = [...sched.errors, ...sched.needsConfirmation.filter((m) => /^(Start|End) time:/.test(m))];
    for (const p of timeProblems) notes.push({ level: "blocker", text: `Fix the event time before publishing. ${p}` });
  }

  const confirmedVenue = intake.venueStatus === "confirmed" && intake.venueName.trim() !== "";
  const location = confirmedVenue ? intake.venueName.trim().slice(0, 160) : "";
  if (!confirmedVenue) notes.push({ level: "info", text: "The venue isn't confirmed, so the card will say “Location to be announced”." });

  return { fields: { title, organizer, date, startTime, endTime, location, locationStatus: confirmedVenue ? "confirmed" : "tba" }, notes };
}

/** Plain-language list of what changed between the published card and the current saved plan. */
export function staleFields(listing: CardFields, current: CardFields): string[] {
  const out: string[] = [];
  if (listing.title !== current.title) out.push("title");
  if (listing.organizer !== current.organizer) out.push("organizer");
  if (listing.date !== current.date) out.push("date");
  if (listing.startTime !== current.startTime || listing.endTime !== current.endTime) out.push("time");
  if (listing.location !== current.location || listing.locationStatus !== current.locationStatus) out.push("location");
  return out;
}

export type ListingRow = {
  id: string;
  title: string;
  organizer: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  location_status: "confirmed" | "tba";
  description: string;
  tags: string[];
  is_sample: boolean;
  plan_version: number;
  published_at: string;
  updated_at: string;
};

export const LISTING_COLUMNS =
  "id,title,organizer,event_date,start_time,end_time,location,location_status,description,tags,is_sample,plan_version,published_at,updated_at";

export function rowToListing(r: ListingRow): Listing {
  return {
    id: r.id,
    title: r.title,
    organizer: r.organizer,
    date: r.event_date,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    locationStatus: r.location_status,
    description: r.description,
    tags: r.tags.filter((t): t is InterestTag => (TAG_IDS as string[]).includes(t)),
    isSample: r.is_sample,
    planVersion: r.plan_version,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

export function listingColumns(id: string, fields: CardFields, body: Pick<PublishBody, "description" | "tags">, isSample: boolean, planVersion: number) {
  return {
    id,
    title: fields.title,
    organizer: fields.organizer,
    event_date: fields.date,
    start_time: fields.startTime,
    end_time: fields.endTime,
    location: fields.location,
    location_status: fields.locationStatus,
    description: body.description.trim(),
    tags: [...new Set(body.tags)],
    is_sample: isSample,
    plan_version: planVersion,
  };
}
