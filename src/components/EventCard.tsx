import Link from "next/link";
import { formatDate, formatTime, monthDay } from "@/lib/dates";
import { tagLabel, type CardFields } from "@/lib/troylens/card";
import { DateChip, Tag } from "./ui";

// Local helper: ui.tsx is a client module, so its functions can't be *called* while this renders on the server.
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export type EventCardData = CardFields & { description: string; tags: string[]; isSample: boolean };

export function whenText(c: Pick<CardFields, "date" | "startTime" | "endTime">): string {
  if (!c.date) return "Date to be announced";
  const day = formatDate(c.date, { weekday: true });
  if (!c.startTime) return `${day} · time to be announced`;
  return `${day} · ${formatTime(c.startTime)}${c.endTime ? `–${formatTime(c.endTime)}` : ""} Pacific`;
}

/** The public, student-facing card. Contains only the shareable fields. */
export function EventCard({
  card,
  href,
  explanation,
  matched = [],
  headingLevel = "h3",
  className,
}: {
  card: EventCardData;
  href?: string;
  explanation?: string | null;
  matched?: string[];
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const H = headingLevel;
  const title = card.title || "Untitled event";
  const md = card.date ? monthDay(card.date) : null;
  const tba = card.locationStatus !== "confirmed";
  return (
    <article className={cx("overflow-hidden rounded-xl border border-line bg-card", className)}>
      {explanation && (
        <p className="flex items-center gap-2 border-b border-gold bg-gold-wash px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-cardinal-deep sm:px-5">
          <span aria-hidden>✦</span>
          {explanation}
        </p>
      )}
      <div className="flex gap-4 p-4 sm:p-5">
        {md && <DateChip month={md[0]} day={md[1]} />}
        <div className="min-w-0 flex-1">
          <H className="font-display text-xl font-bold leading-snug">
            {href ? (
              <Link href={href} className="hover:text-cardinal hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </H>
          {card.organizer && <p className="text-sm text-muted">by {card.organizer}</p>}
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="sr-only">When</dt>
              <dd className={cx("font-medium", !card.date && "italic text-muted")}>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline -translate-y-px text-cardinal">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {whenText(card)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Where</dt>
              <dd className={cx("font-medium", tba && "text-amber")}>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx("mr-1.5 inline -translate-y-px", tba ? "text-amber" : "text-cardinal")}>
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {tba ? "Location to be announced" : card.location}
              </dd>
            </div>
          </dl>
          {card.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{card.description}</p>}
          {(card.tags.length > 0 || card.isSample) && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
              {card.isSample && (
                <li>
                  <Tag tone="gold">Fictional sample</Tag>
                </li>
              )}
              {card.tags.map((t) => (
                <li key={t}>
                  <Tag tone={matched.includes(t) ? "cardinal" : "neutral"}>{tagLabel(t)}</Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
