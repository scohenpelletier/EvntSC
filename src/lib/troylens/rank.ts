import { tagLabel, TAG_IDS, type InterestTag, type Listing } from "./card";

/**
 * Discover ranking: deterministic topic overlap, nothing learned.
 * score = number of the viewer's selected tags the event carries.
 * Ties: dated events before "date TBA", then earlier date, earlier start, title, id.
 */

export type Ranked = { listing: Listing; matched: InterestTag[]; explanation: string | null };

export function parseTags(raw: string | string[] | undefined): InterestTag[] {
  const parts = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",").map((s) => s.trim());
  return TAG_IDS.filter((id) => parts.includes(id));
}

export function explain(matched: InterestTag[]): string | null {
  if (!matched.length) return null;
  const labels = matched.map(tagLabel);
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `Matches your ${list} interest${labels.length > 1 ? "s" : ""}`;
}

function compareWhen(a: Listing, b: Listing): number {
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  const at = a.startTime ?? "99:99";
  const bt = b.startTime ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  const t = a.title.localeCompare(b.title);
  return t !== 0 ? t : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Upcoming = dated today or later, or date not yet announced. Past events are left out. */
export function rankListings(listings: Listing[], selected: InterestTag[], today: string): { matches: Ranked[]; others: Ranked[] } {
  const chosen = new Set(selected);
  const ranked = listings
    .filter((l) => !l.date || l.date >= today)
    .map((listing) => {
      // Order matched tags by the viewer's selection order for a stable explanation.
      const matched = selected.filter((t) => listing.tags.includes(t) && chosen.has(t));
      return { listing, matched, explanation: explain(matched) };
    })
    .sort((a, b) => b.matched.length - a.matched.length || compareWhen(a.listing, b.listing));
  return { matches: ranked.filter((r) => r.matched.length > 0), others: ranked.filter((r) => r.matched.length === 0) };
}
