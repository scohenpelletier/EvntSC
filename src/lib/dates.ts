import { DateTime } from "luxon";
import { CAMPUS_TIMEZONE, type Intake } from "./schema";

/**
 * All event dates are wall-clock values in America/Los_Angeles. Instants are
 * resolved explicitly so that DST gaps (spring forward) are rejected and DST
 * overlaps (fall back) require the organizer to pick an offset.
 */

export type WallTimeResolution =
  | { kind: "ok"; instant: DateTime }
  | { kind: "gap"; message: string }
  | { kind: "ambiguous"; earlier: DateTime; later: DateTime; message: string }
  | { kind: "invalid"; message: string };

export function resolveWallTime(date: string, time: string, zone = CAMPUS_TIMEZONE): WallTimeResolution {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) return { kind: "invalid", message: "Invalid date or time" };
  const probe = DateTime.fromObject({ year: y, month: mo, day: d, hour: h, minute: mi }, { zone });
  if (!probe.isValid) return { kind: "invalid", message: probe.invalidExplanation ?? "Invalid date or time" };

  // Try every offset seen within ±3h and keep those that map back to the same wall time.
  const offsets = new Set<number>([
    probe.offset,
    probe.minus({ hours: 3 }).offset,
    probe.plus({ hours: 3 }).offset,
  ]);
  const candidates: DateTime[] = [];
  for (const off of offsets) {
    const utcMillis = Date.UTC(y, mo - 1, d, h, mi) - off * 60_000;
    const dt = DateTime.fromMillis(utcMillis, { zone });
    if (dt.year === y && dt.month === mo && dt.day === d && dt.hour === h && dt.minute === mi) {
      if (!candidates.some((c) => c.toMillis() === dt.toMillis())) candidates.push(dt);
    }
  }
  candidates.sort((a, b) => a.toMillis() - b.toMillis());
  if (candidates.length === 0) {
    return { kind: "gap", message: `${time} does not exist on ${date} in Los Angeles (clocks spring forward). Choose another time.` };
  }
  if (candidates.length > 1) {
    return {
      kind: "ambiguous",
      earlier: candidates[0],
      later: candidates[candidates.length - 1],
      message: `${time} happens twice on ${date} in Los Angeles (clocks fall back). Choose the first (PDT) or second (PST) occurrence.`,
    };
  }
  return { kind: "ok", instant: candidates[0] };
}

export type ScheduleCheck = {
  errors: string[];
  needsConfirmation: string[];
  start: DateTime | null;
  end: DateTime | null;
};

export function checkSchedule(intake: Intake): ScheduleCheck {
  const errors: string[] = [];
  const needsConfirmation: string[] = [];
  let start: DateTime | null = null;
  let end: DateTime | null = null;
  if (!intake.date) return { errors, needsConfirmation, start, end };

  const day = DateTime.fromISO(intake.date, { zone: CAMPUS_TIMEZONE });
  if (!day.isValid) {
    errors.push("Event date is not a real calendar date");
    return { errors, needsConfirmation, start, end };
  }
  if (!intake.dateConfirmed) needsConfirmation.push("The event date was read from a description and has not been confirmed.");

  const pick = (time: string | null, label: string): DateTime | null => {
    if (!time) return null;
    const r = resolveWallTime(intake.date!, time);
    if (r.kind === "ok") return r.instant;
    if (r.kind === "ambiguous") {
      if (intake.dstChoice) return intake.dstChoice === "earlier" ? r.earlier : r.later;
      needsConfirmation.push(`${label}: ${r.message}`);
      return r.earlier;
    }
    errors.push(`${label}: ${r.message}`);
    return null;
  };
  start = pick(intake.startTime, "Start time");
  end = pick(intake.endTime, "End time");
  if (start && end && end.toMillis() <= start.toMillis()) {
    errors.push("End time must be after start time (overnight events are not supported).");
  }
  return { errors, needsConfirmation, start, end };
}

/** Today's date in the campus timezone. NEXT_PUBLIC_REFERENCE_DATE pins it for demos/tests. */
export function campusToday(): string {
  const pinned = process.env.NEXT_PUBLIC_REFERENCE_DATE;
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  return DateTime.now().setZone(CAMPUS_TIMEZONE).toISODate()!;
}

/** Calendar-day offset. Only use for rules stated in plain (calendar) days/weeks. */
export function addCalendarDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: CAMPUS_TIMEZONE }).plus({ days }).toISODate()!;
}

export function formatDate(isoDate: string | null, opts: { weekday?: boolean } = {}): string {
  if (!isoDate) return "Date unknown";
  const dt = DateTime.fromISO(isoDate, { zone: CAMPUS_TIMEZONE });
  if (!dt.isValid) return isoDate;
  return dt.toFormat(opts.weekday ? "ccc, LLL d, yyyy" : "LLL d, yyyy");
}

export function formatTime(time: string | null): string {
  if (!time) return "time unknown";
  const [h, m] = time.split(":").map(Number);
  return DateTime.fromObject({ hour: h, minute: m }).toFormat("h:mm a");
}

export function zoneAbbrev(instant: DateTime | null): string {
  return instant ? instant.toFormat("ZZZZ") : "PT";
}

/**
 * Natural-language date guard: flags phrases with no explicit year or with
 * relative/ambiguous wording so an AI-proposed date is never silently accepted.
 */
export function dateWordingNeedsConfirmation(phrase: string): string | null {
  const p = phrase.toLowerCase();
  if (!/\b(19|20)\d{2}\b/.test(p)) return "The description did not state a year.";
  if (/\b(next|this|coming|upcoming|early|mid|late|around|sometime|tbd|or)\b/.test(p)) {
    return "The description used relative or ambiguous wording.";
  }
  return null;
}

/** "2027-02-10" → ["Feb", "10"] for date chips (calendar date only; no timezone shift). */
export function monthDay(iso: string): [string, string] {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return [month, String(d).padStart(2, "0")];
}
