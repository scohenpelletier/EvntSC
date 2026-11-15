"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { formatDate } from "@/lib/dates";
import { INTEREST_TAGS, splitPlaybook, tagLabel, type InterestTag } from "@/lib/troylens/card";
import { FORMATS, formatLabel, offsetText, type AroundPlan, type Club, type FormatId, type Idea } from "@/lib/troylens/discover";
import { whenText } from "./EventCard";
import { cx, Tag } from "./ui";

type TabId = "ideas" | "around" | "clubs";
const TABS: { id: TabId; label: string; question: string }[] = [
  { id: "ideas", label: "Ideas", question: "What could our club host?" },
  { id: "around", label: "Around your dates", question: "What else is happening around our date?" },
  { id: "clubs", label: "Clubs", question: "Who could we collaborate with?" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
        on ? "border-cardinal bg-cardinal text-white" : "border-line-strong bg-card text-ink hover:border-cardinal",
      )}
    >
      {children}
    </button>
  );
}

function PlanLikeThis({ id, signedIn }: { id: string; signedIn: boolean }) {
  return signedIn ? (
    <Link href={`/plans/new?like=${id}`} className="rounded-md bg-cardinal px-3 py-1.5 text-sm font-semibold text-white hover:bg-cardinal-ink">
      Plan something like this
    </Link>
  ) : (
    <Link href="/sign-in" className="rounded-md border border-cardinal px-3 py-1.5 text-sm font-semibold text-cardinal hover:bg-cardinal-wash">
      Sign in to plan something like this
    </Link>
  );
}

function IdeaCard({ idea, signedIn }: { idea: Idea; signedIn: boolean }) {
  const l = idea.listing;
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span title="Format guessed from the title and description">
          <Tag tone="cardinal">{formatLabel(idea.format)}</Tag>
        </span>
        {idea.past && <Tag>Completed</Tag>}
        {splitPlaybook(l.description).howItWent && <Tag tone="green">Has playbook</Tag>}
        {l.isSample && <Tag tone="amber">Sample</Tag>}
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{l.title || "Untitled event"}</h3>
      <p className="text-sm text-muted">
        {l.organizer || "Student organization"} · {l.date ? formatDate(l.date) : "Date TBA"}
      </p>
      {splitPlaybook(l.description).description && <p className="mt-2 line-clamp-3 text-sm">{splitPlaybook(l.description).description}</p>}
      {splitPlaybook(l.description).howItWent && (
        <p className="mt-2 line-clamp-2 text-sm">
          <span className="font-semibold">How it went:</span> {splitPlaybook(l.description).howItWent}
        </p>
      )}
      {l.tags.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1">
          {l.tags.map((t) => (
            <span key={t} className={cx("rounded-full px-2 py-0.5 text-xs", idea.sharedTopics.includes(t) ? "bg-gold/30 font-semibold" : "bg-paper text-muted")}>
              {tagLabel(t)}
            </span>
          ))}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <PlanLikeThis id={l.id} signedIn={signedIn} />
        <Link href={`/events/${l.id}`} className="text-sm text-muted underline hover:text-ink">
          View event
        </Link>
      </div>
    </article>
  );
}

function IdeasTab({ ideas, signedIn, query, setQuery }: { ideas: Idea[]; signedIn: boolean; query: string; setQuery: (q: string) => void }) {
  const [format, setFormat] = useState<FormatId | "all">("all");
  const [topic, setTopic] = useState<InterestTag | "all">("all");
  const present = useMemo(() => new Set(ideas.map((i) => i.format)), [ideas]);
  const shown = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return ideas.filter((i) => {
      if (format !== "all" && i.format !== format) return false;
      if (topic !== "all" && !i.listing.tags.includes(topic)) return false;
      const hay = norm([i.listing.title, i.listing.organizer, i.listing.description].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [ideas, format, topic, query]);

  return (
    <div>
      <div className="space-y-2 rounded-xl border border-line bg-card p-3">
        <label className="block">
          <span className="sr-only">Search ideas</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by event or club"
            className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[15px]"
          />
        </label>
        <div role="group" aria-label="Filter by format" className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={format === "all"} onClick={() => setFormat("all")}>
            All formats
          </Chip>
          {FORMATS.filter((f) => present.has(f.id)).map((f) => (
            <Chip key={f.id} on={format === f.id} onClick={() => setFormat(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Filter by topic" className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={topic === "all"} onClick={() => setTopic("all")}>
            All topics
          </Chip>
          {INTEREST_TAGS.map((t) => (
            <Chip key={t.id} on={topic === t.id} onClick={() => setTopic(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {shown.length} of {ideas.length} ideas shown
      </p>
      {shown.length ? (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <li key={i.listing.id}>
              <IdeaCard idea={i} signedIn={signedIn} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">No events match these filters.</p>
      )}
    </div>
  );
}

function AroundTab({ around, signedIn, hasPlans }: { around: AroundPlan[]; signedIn: boolean; hasPlans: boolean }) {
  if (!signedIn)
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm">
        <Link href="/sign-in" className="font-semibold text-cardinal underline">
          Sign in
        </Link>{" "}
        to see what other clubs have planned in the week around each of your events.
      </p>
    );
  if (!around.length)
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm">
        {hasPlans ? "None of your upcoming plans has a date yet." : "You don't have any plans yet."}{" "}
        <Link href={hasPlans ? "/plans" : "/plans/new"} className="font-semibold text-cardinal underline">
          {hasPlans ? "Set a date on a plan" : "Plan an event"}
        </Link>{" "}
        to compare it with other clubs&apos; events.
      </p>
    );
  return (
    <div className="space-y-5">
      {around.map((a) => (
        <section key={a.planId} aria-labelledby={`around-${a.planId}`} className="rounded-xl border border-line bg-card p-4">
          <h3 id={`around-${a.planId}`} className="font-semibold">
            <Link href={`/plans/${a.planId}`} className="hover:underline">
              {a.planTitle}
            </Link>{" "}
            <span className="font-normal text-muted">· {formatDate(a.date, { weekday: true })}</span>
          </h3>
          {a.nearby.length ? (
            <ul className="mt-3 divide-y divide-line">
              {a.nearby.map((n) => (
                <li key={n.idea.listing.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                  <span className={cx("w-24 shrink-0 font-semibold", n.offsetDays === 0 && "text-cardinal")}>{offsetText(n.offsetDays)}</span>
                  <Link href={`/events/${n.idea.listing.id}`} className="font-medium hover:underline">
                    {n.idea.listing.title}
                  </Link>
                  <span className="text-muted">
                    {n.idea.listing.organizer} · {formatLabel(n.idea.format)}
                    {n.idea.listing.startTime ? ` · ${whenText(n.idea.listing).split(" · ")[1]}` : ""}
                  </span>
                  {n.similarAudience && <Tag tone="amber">Similar audience</Tag>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No other published events within a week of this date.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function ClubsTab({ clubs, onSeeEvents }: { clubs: Club[]; onSeeEvents: (name: string) => void }) {
  if (!clubs.length) return <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">No clubs have published events yet.</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {clubs.map((c) => (
        <li key={c.name} className="flex flex-col rounded-xl border border-line bg-card p-4">
          <h3 className="font-semibold">{c.name}</h3>
          <p className="text-sm text-muted">
            {c.events.length} event{c.events.length === 1 ? "" : "s"} · {c.formats.map(formatLabel).join(", ")}
          </p>
          {c.topics.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1">
              {c.topics.map((t) => (
                <span key={t} className={cx("rounded-full px-2 py-0.5 text-xs", c.sharedTopics.includes(t) ? "bg-gold/30 font-semibold" : "bg-paper text-muted")}>
                  {tagLabel(t)}
                </span>
              ))}
            </p>
          )}
          {c.sharedTopics.length > 0 && <p className="mt-2 text-sm">Shares your interest in {c.sharedTopics.map(tagLabel).join(", ")}.</p>}
          {c.next && (
            <p className="mt-1 text-sm">
              Next:{" "}
              <Link href={`/events/${c.next.listing.id}`} className="underline">
                {c.next.listing.title}
              </Link>{" "}
              <span className="text-muted">({formatDate(c.next.listing.date!)})</span>
            </p>
          )}
          <button type="button" onClick={() => onSeeEvents(c.name)} className="mt-auto self-start pt-3 text-sm font-semibold text-cardinal underline">
            See their events
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DiscoverHub({
  ideas,
  around,
  clubs,
  signedIn,
  hasPlans,
}: {
  ideas: Idea[];
  around: AroundPlan[];
  clubs: Club[];
  signedIn: boolean;
  hasPlans: boolean;
}) {
  const [tab, setTab] = useState<TabId>("ideas");
  const [query, setQuery] = useState("");
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ ideas: null, around: null, clubs: null });
  const nearbyCount = around.reduce((n, a) => n + a.nearby.length, 0);
  const current = TABS.find((t) => t.id === tab)!;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Discover views" className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`dtab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`dpanel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => setTab(t.id)}
            className={cx(
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold sm:px-4",
              tab === t.id ? "border-cardinal text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.id === "ideas" && <span className="ml-1.5 text-xs font-normal text-muted">{ideas.length}</span>}
            {t.id === "around" && nearbyCount > 0 && <span className="ml-1.5 rounded-full bg-amber px-1.5 text-xs text-white">{nearbyCount}</span>}
            {t.id === "clubs" && <span className="ml-1.5 text-xs font-normal text-muted">{clubs.length}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`dpanel-${tab}`} aria-labelledby={`dtab-${tab}`} className="mt-5">
        <h2 className="mb-4 font-display text-2xl font-bold">{current.question}</h2>
        {tab === "ideas" && <IdeasTab ideas={ideas} signedIn={signedIn} query={query} setQuery={setQuery} />}
        {tab === "around" && <AroundTab around={around} signedIn={signedIn} hasPlans={hasPlans} />}
        {tab === "clubs" && (
          <ClubsTab
            clubs={clubs}
            onSeeEvents={(name) => {
              setQuery(name);
              setTab("ideas");
            }}
          />
        )}
      </div>
    </div>
  );
}
