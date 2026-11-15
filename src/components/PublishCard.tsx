"use client";
import { campusToday } from "@/lib/dates";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Intake } from "@/lib/schema";
import { cardFromIntake, draftPublicDescription, joinPlaybook, splitPlaybook, INTEREST_TAGS, MAX_DESCRIPTION, MAX_TAGS, staleFields, type InterestTag, type Listing } from "@/lib/troylens/card";
import { useConfirm } from "./ConfirmDialog";
import { EventCard } from "./EventCard";
import { Alert, Button, cx, Tag, TextArea } from "./ui";

/**
 * TroyLens publish panel. Publishing is explicit and always built from the
 * saved plan; budgets, tasks, notes, questions and account details stay private.
 */
export function PublishCard({
  planId,
  planVersion,
  intake,
  dirty,
  isSample,
  initialListing,
  syncedListing,
  onListingChange,
}: {
  planId: string;
  planVersion: number;
  intake: Intake;
  dirty: boolean;
  isSample: boolean;
  initialListing: Listing | null;
  /** The shared copy as refreshed by the latest save (undefined until a save reports one). */
  syncedListing?: Listing | null;
  /** Lets the plan page know when the card is published or removed. */
  onListingChange?: (listing: Listing | null) => void;
}) {
  const confirm = useConfirm();
  const [listing, setListing] = useState<Listing | null>(initialListing);
  // A save refreshes the shared event's details on the server; take that copy (adjusting state during render).
  const [seenSync, setSeenSync] = useState(syncedListing);
  if (syncedListing !== seenSync) {
    setSeenSync(syncedListing);
    if (syncedListing !== undefined && listing) setListing(syncedListing);
  }
  // Unpublished cards start from a draft joined from the plan (purpose, description without money, guests, food).
  const [description, setDescription] = useState(() => (initialListing ? splitPlaybook(initialListing.description).description : draftPublicDescription(intake)));
  // After the event: a short note that turns the shared event into a playbook for other clubs.
  const [howItWent, setHowItWent] = useState(() => (initialListing ? splitPlaybook(initialListing.description).howItWent : ""));
  const eventPassed = !!intake.date && intake.date < campusToday();
  const combined = joinPlaybook(description, howItWent);
  const [tags, setTags] = useState<InterestTag[]>(initialListing?.tags ?? []);
  const [busy, setBusy] = useState<"publish" | "retract" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { fields, notes } = useMemo(() => cardFromIntake(intake), [intake]);
  const blocker = notes.find((n) => n.level === "blocker");
  const stale = listing && !dirty ? staleFields(listing, fields) : [];
  const textChanged = listing ? listing.description !== combined || [...listing.tags].sort().join() !== [...tags].sort().join() : false;

  const toggle = (t: InterestTag) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= MAX_TAGS ? cur : [...cur, t]));

  async function publish() {
    const ok = await confirm({
      title: listing ? "Update your shared event?" : "Share this event with other clubs?",
      body: (
        <div className="space-y-2">
          <p>Officers using EvntSC Discover will be able to see:</p>
          <p className="font-medium">title, club, confirmed date and time, location (or “to be announced”), your description{howItWent.trim() ? ", how it went," : ""} and topic tags.</p>
          <p>Your budget, checklist, notes, open questions, and account details stay private. You can stop sharing at any time.</p>
        </div>
      ),
      confirmLabel: listing ? "Update" : "Share event",
    });
    if (!ok) return;
    setBusy("publish");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/plans/${planId}/listing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planVersion, description: combined, tags }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Publishing failed (${res.status}).`);
      setListing(data.listing);
      onListingChange?.(data.listing);
      setDescription(splitPlaybook(data.listing.description).description);
      setHowItWent(splitPlaybook(data.listing.description).howItWent);
      setMessage(listing ? "Shared event updated." : "Shared with other clubs.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publishing failed.");
    } finally {
      setBusy(null);
    }
  }

  async function retract() {
    const ok = await confirm({
      title: "Stop sharing this event?",
      body: "It disappears from Discover and its link stops working. Your plan isn't affected, and you can share it again later.",
      confirmLabel: "Stop sharing",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("retract");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/plans/${planId}/listing`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(data.error ?? `Retracting failed (${res.status}).`);
      setListing(null);
      onListingChange?.(null);
      setMessage("Card retracted. It is no longer public.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retracting failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="publish" aria-labelledby="card-h" className="no-print mt-6 scroll-mt-6 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="card-h" className="flex items-center gap-2.5 font-display text-xl font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          Share with other clubs
        </h2>
        {listing ? <Tag tone="green">Shared</Tag> : <Tag>Not shared</Tag>}
      </div>
      <p className="mt-1 text-sm text-muted">
        Other club officers see shared events on{" "}
        <Link href="/discover" className="underline">
          Discover
        </Link>{" "}
        to avoid date clashes, find co-hosts, and borrow ideas. Students find events on EngageSC.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_minmax(0,380px)]">
        <div className="space-y-4">
          <TextArea
            label="Public description"
            hint={`What other officers will see. Don't include budget or internal details. ${combined.length}/${MAX_DESCRIPTION}`}
            rows={4}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {draftPublicDescription(intake) && description.trim() !== draftPublicDescription(intake) && (
            <Button size="sm" variant="ghost" onClick={() => setDescription(draftPublicDescription(intake))}>
              {description.trim() ? "Replace with a draft from the plan" : "Fill from the plan's details"}
            </Button>
          )}
          {(eventPassed || howItWent) && (
            <TextArea
              label="How it went (optional)"
              hint="After the event: turnout, what worked, what you'd change. This makes your event a playbook other clubs can plan from."
              rows={3}
              maxLength={600}
              value={howItWent}
              onChange={(e) => setHowItWent(e.target.value)}
            />
          )}
          <fieldset>
            <legend className="text-sm font-medium">
              Topic tags <span className="font-normal text-muted">(up to {MAX_TAGS})</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTEREST_TAGS.map((t) => {
                const on = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && tags.length >= MAX_TAGS}
                    onClick={() => toggle(t.id)}
                    className={cx(
                      "rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40",
                      on ? "border-cardinal bg-cardinal font-medium text-white" : "border-line-strong bg-card hover:border-ink",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {notes.length > 0 && (
            <ul className="space-y-1 text-sm">
              {notes.map((n) => (
                <li key={n.text} className={n.level === "blocker" ? "font-medium text-cardinal" : "text-muted"}>
                  {n.level === "blocker" ? "✕ " : "• "}
                  {n.text}
                </li>
              ))}
            </ul>
          )}

          {dirty && (
            <Alert tone="warning" title="Save your plan first">
              Cards are built from the saved plan, so publishing is paused while you have unsaved changes.
            </Alert>
          )}
          {stale.length > 0 && (
            <Alert tone="warning" title="Your shared event is out of date">
              The saved plan&apos;s {stale.join(", ")} changed since you shared it. Update it to share the current details.
            </Alert>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={publish}
              disabled={busy !== null || dirty || !!blocker || (!!listing && stale.length === 0 && !textChanged)}
            >
              {busy === "publish" ? "Sharing…" : listing ? "Update shared event" : "Share event"}
            </Button>
            {listing && (
              <>
                <Link href={`/events/${listing.id}`} className="inline-flex items-center rounded-md border border-line-strong px-4 py-2 text-sm font-medium hover:border-ink">
                  View shared page
                </Link>
                <Button variant="danger" onClick={retract} disabled={busy !== null}>
                  {busy === "retract" ? "Removing…" : "Stop sharing"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">Preview: what other officers will see</p>
          <EventCard card={{ ...fields, description: combined, tags, isSample }} />
        </div>
      </div>
    </section>
  );
}
