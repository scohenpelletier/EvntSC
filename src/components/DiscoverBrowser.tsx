"use client";
import { useMemo, useState } from "react";
import { INTEREST_TAGS, type InterestTag } from "@/lib/troylens/card";
import type { Ranked } from "@/lib/troylens/rank";
import { EventCard } from "./EventCard";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Search and topic filters over already-ranked listings. Filtering is client-side; nothing is sent anywhere. */
export function DiscoverBrowser({ matches, others, selected }: { matches: Ranked[]; others: Ranked[]; selected: InterestTag[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<InterestTag | "all">("all");

  const filter = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return (rows: Ranked[]) =>
      rows.filter(({ listing: l }) => {
        if (topic !== "all" && !l.tags.includes(topic)) return false;
        if (!words.length) return true;
        const hay = norm([l.title, l.organizer, l.location, l.description].join(" "));
        return words.every((w) => hay.includes(w));
      });
  }, [query, topic]);

  const m = filter(matches);
  const o = filter(others);
  const filtering = query.trim() !== "" || topic !== "all";
  const total = matches.length + others.length;

  const chip = (id: InterestTag | "all", label: string) => {
    const on = topic === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => setTopic(id)}
        className={
          "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors " +
          (on ? "border-cardinal bg-cardinal text-white" : "border-line-strong bg-card text-ink hover:border-cardinal")
        }
      >
        {label}
        {id !== "all" && selected.includes(id) && <span aria-label="(one of your interests)" className="ml-1 text-gold">★</span>}
      </button>
    );
  };

  const grid = (rows: Ranked[], withWhy: boolean) => (
    <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.listing.id}>
          <EventCard
            card={r.listing}
            href={`/events/${r.listing.id}`}
            explanation={withWhy ? r.explanation : undefined}
            matched={withWhy ? r.matched : undefined}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  );

  const heading = (id: string, text: string, n: number) => (
    <h2 id={id} className="flex items-center gap-2.5 font-display text-2xl font-bold">
      <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
      {text} <span className="font-sans text-base font-normal text-muted">({n})</span>
    </h2>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search events</span>
          <svg aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by event, organization, or place"
            className="w-full rounded-md border border-line-strong bg-white py-2.5 pr-3 pl-10 text-[15px] focus:border-cardinal"
          />
        </label>
        <div role="group" aria-label="Filter by topic" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {chip("all", "All topics")}
          {INTEREST_TAGS.map((t) => chip(t.id, t.label))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {filtering ? `${m.length + o.length} of ${total} events shown` : ""}
      </p>

      {filtering && m.length + o.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line-strong bg-card p-8 text-center">
          <p className="font-display text-lg font-bold">No events match</p>
          <p className="mt-1 text-sm text-muted">Try another word or topic.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTopic("all");
            }}
            className="mt-3 text-sm font-semibold text-cardinal underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {selected.length > 0 && (m.length > 0 || (!filtering && matches.length === 0 && total > 0)) && (
        <section aria-labelledby="matches-h" className="mt-8">
          {heading("matches-h", "Matches your interests", m.length)}
          {m.length ? (
            grid(m, true)
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-line-strong p-4 text-sm text-muted">No upcoming events carry those topics yet.</p>
          )}
        </section>
      )}

      {o.length > 0 && (
        <section aria-labelledby="others-h" className="mt-10">
          {heading("others-h", selected.length ? "Other upcoming events" : "Upcoming events", o.length)}
          {grid(o, false)}
        </section>
      )}
    </div>
  );
}
