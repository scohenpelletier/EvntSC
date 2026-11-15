import { daysBetween } from "../policy/engine";
import type { Intake } from "../schema";
import { tagLabel, type InterestTag, type Listing } from "./card";

/**
 * Discover for club officers. Pure functions over published event cards that answer:
 *   1. "What could our club host?"            → ideas()
 *   2. "What else is happening around our date?" → aroundDates()
 *   3. "Who could we collaborate with?"       → clubs()
 * plus seedFromListing() for "Plan something like this".
 *
 * Cards only carry the public fields (title, club, date, time, location, description, topics),
 * so the format is inferred from the title and description and always labeled as such.
 */

export const FORMATS = [
  { id: "panel", label: "Panel", words: ["panel", "panelist", "fireside", "q&a with", "roundtable"] },
  { id: "workshop", label: "Workshop", words: ["workshop", "hands-on", "bootcamp", "tutorial", "build your", "training", "clinic"] },
  { id: "networking", label: "Networking", words: ["networking", "mixer", "meet and greet", "meet & greet", "career night", "coffee chat"] },
  { id: "speaker", label: "Speaker talk", words: ["speaker", "talk", "keynote", "lecture", "founder", "guest"] },
  { id: "info_session", label: "Info session", words: ["info session", "information session", "general meeting", "gm", "orientation", "open house"] },
  { id: "competition", label: "Competition", words: ["hackathon", "competition", "pitch", "case comp", "challenge", "tournament"] },
  { id: "social", label: "Social", words: ["social", "game night", "potluck", "picnic", "party", "festival", "celebration", "movie night"] },
] as const;
export type FormatId = (typeof FORMATS)[number]["id"] | "other";
export const formatLabel = (id: FormatId) => FORMATS.find((f) => f.id === id)?.label ?? "Other";

/** First format whose keywords appear in the title, then in the description. */
export function inferFormat(l: Pick<Listing, "title" | "description">): FormatId {
  const has = (text: string, w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}([^a-z]|$)`).test(text);
  for (const text of [l.title.toLowerCase(), l.description.toLowerCase()]) {
    const f = FORMATS.find((x) => x.words.some((w) => has(text, w)));
    if (f) return f.id;
  }
  return "other";
}

/** The planner's event types; formats without a match use "other" (the planner says its guidance is limited). */
export function formatToEventType(f: FormatId): Intake["eventType"] {
  if (f === "networking") return "networking";
  if (f === "workshop") return "workshop";
  if (f === "info_session" || f === "panel" || f === "speaker") return "info_session";
  return "other";
}

const shared = (a: InterestTag[], b: InterestTag[]) => a.filter((t) => b.includes(t));

// ---- 1. What could our club host? ------------------------------------------

export type Idea = { listing: Listing; format: FormatId; past: boolean; sharedTopics: InterestTag[] };

/** Every card as an idea: ones that share the officer's interests first, then upcoming before past, newest first. */
export function ideas(listings: Listing[], interests: InterestTag[], today: string): Idea[] {
  return listings
    .map((l) => ({ listing: l, format: inferFormat(l), past: !!l.date && l.date < today, sharedTopics: shared(l.tags, interests) }))
    .sort(
      (a, b) =>
        b.sharedTopics.length - a.sharedTopics.length ||
        Number(a.past) - Number(b.past) ||
        (a.past ? (b.listing.date ?? "").localeCompare(a.listing.date ?? "") : (a.listing.date ?? "9999").localeCompare(b.listing.date ?? "9999")),
    );
}

// ---- 2. What else is happening around our date? ---------------------------

export type PlanDate = { id: string; title: string; date: string | null };
export type Nearby = { idea: Idea; offsetDays: number; similarAudience: boolean };
export type AroundPlan = { planId: string; planTitle: string; date: string; nearby: Nearby[] };

/**
 * For each of the officer's dated, upcoming plans: other clubs' events within ±window days.
 * "Similar audience" means the event shares a topic with the officer's interests.
 * A listing's id is its plan's id, so the officer's own published cards are left out.
 */
export function aroundDates(listings: Listing[], plans: PlanDate[], interests: InterestTag[], today: string, windowDays = 7): AroundPlan[] {
  const own = new Set(plans.map((p) => p.id));
  const pool = ideas(listings, interests, today).filter((i) => !own.has(i.listing.id) && i.listing.date);
  return plans
    .filter((p): p is PlanDate & { date: string } => !!p.date && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      planId: p.id,
      planTitle: p.title.trim() || "Untitled event",
      date: p.date,
      nearby: pool
        .map((idea) => ({ idea, offsetDays: daysBetween(p.date, idea.listing.date!), similarAudience: idea.sharedTopics.length > 0 }))
        .filter((n) => Math.abs(n.offsetDays) <= windowDays)
        .sort((a, b) => Math.abs(a.offsetDays) - Math.abs(b.offsetDays) || Number(b.similarAudience) - Number(a.similarAudience)),
    }));
}

/** "Same day", "2 days before", "1 day after". */
export function offsetText(days: number): string {
  if (days === 0) return "Same day";
  const n = Math.abs(days);
  return `${n} day${n === 1 ? "" : "s"} ${days < 0 ? "before" : "after"}`;
}

// ---- 3. Who could we collaborate with? ------------------------------------

export type Club = {
  name: string;
  events: Idea[];
  topics: InterestTag[];
  formats: FormatId[];
  sharedTopics: InterestTag[];
  next: Idea | null;
};

/** Clubs that published cards, grouped by organizer name; clubs sharing the officer's interests first. */
export function clubs(listings: Listing[], interests: InterestTag[], today: string, ownPlanIds: string[] = []): Club[] {
  const own = new Set(ownPlanIds);
  const groups = new Map<string, Idea[]>();
  for (const idea of ideas(listings, interests, today)) {
    const name = idea.listing.organizer.trim();
    if (!name || own.has(idea.listing.id)) continue;
    const key = name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), idea]);
  }
  return [...groups.values()]
    .map((events) => {
      const topics = [...new Set(events.flatMap((e) => e.listing.tags))];
      const upcoming = events.filter((e) => !e.past && e.listing.date).sort((a, b) => a.listing.date!.localeCompare(b.listing.date!));
      return {
        name: events[0].listing.organizer.trim(),
        events,
        topics,
        formats: [...new Set(events.map((e) => e.format))],
        sharedTopics: shared(topics, interests),
        next: upcoming[0] ?? null,
      };
    })
    .sort((a, b) => b.sharedTopics.length - a.sharedTopics.length || b.events.length - a.events.length || a.name.localeCompare(b.name));
}

// ---- Plan something like this ---------------------------------------------

export type Inspiration = { listingId: string; title: string; organizer: string };

/**
 * A starting intake modelled on another club's event: its format and topics only. The other
 * club's date, time, place, size, budget, and food are deliberately NOT copied; the organizer
 * describes their own, and the original event is credited on the plan.
 */
export function seedFromListing(l: Listing, organization = ""): Partial<Intake> {
  const format = inferFormat(l);
  const topics = l.tags.map(tagLabel).join(", ");
  const kind = format === "other" ? "event" : formatLabel(format).toLowerCase();
  return {
    eventType: formatToEventType(format),
    title: format === "other" ? "" : `${formatLabel(format)}${topics ? ` on ${l.tags.map(tagLabel)[0]}` : ""}`,
    purpose: topics ? `A ${kind} on ${topics}` : "",
    organization,
    description: `We want to host a ${kind} like “${l.title}” by ${l.organizer || "another club"}, adapted for our club.`,
    inspiredBy: { listingId: l.id, title: l.title.slice(0, 160), organizer: l.organizer.slice(0, 160) },
  };
}

const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[sample\]|\(fictional\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * When a plan starts from another club's event, the description names that club and event, so
 * the AI may propose them as this plan's organization or title. Drop those: the original is
 * credited separately in `inspiredBy`, and the plan belongs to the organizer's own club.
 */
export function withoutOriginalIdentity(fields: Partial<Intake>, inspiredBy: Inspiration | null): { fields: Partial<Intake>; dropped: string[] } {
  if (!inspiredBy) return { fields, dropped: [] };
  const out = { ...fields };
  const dropped: string[] = [];
  const org = plain(inspiredBy.organizer);
  const title = plain(inspiredBy.title);
  if (out.organization && org && (plain(out.organization).includes(org) || org.includes(plain(out.organization)))) {
    delete out.organization;
    dropped.push("organization");
  }
  if (out.title && title && (plain(out.title).includes(title) || title.includes(plain(out.title)))) {
    delete out.title;
    dropped.push("title");
  }
  return { fields: out, dropped };
}
