import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoverBrowser } from "@/components/DiscoverBrowser";
import { Alert, PageBand } from "@/components/ui";
import { campusToday } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { tagLabel, troyLensEnabled, type Listing } from "@/lib/troylens/card";
import { rankListings } from "@/lib/troylens/rank";
import { isMissingTable, listUpcoming } from "@/lib/troylens/repo";

export const metadata: Metadata = { title: "Discover · EvntSC" };

/** Interests come from the signed-in account (set on /settings); signed-out visitors see a chronological list. */
export default async function DiscoverPage() {
  if (!troyLensEnabled()) notFound();
  const user = await getUser();
  const selected = user?.interests ?? [];
  const today = campusToday();

  let listings: Listing[] = [];
  let problem: string | null = null;
  if (!isSupabaseConfigured()) problem = "Accounts aren't configured on this server, so there are no published events to show.";
  else {
    try {
      listings = await listUpcoming(await createClient(), today);
    } catch (e) {
      problem = isMissingTable(e)
        ? "Event cards aren't set up on this server yet (run supabase/migrations/0002_event_listings.sql)."
        : "Couldn't load events right now. Try again in a moment.";
    }
  }
  const { matches, others } = rankListings(listings, selected, today);

  const interestsLine = !user ? (
    <>
      <Link href="/sign-in" className="font-semibold text-gold underline">
        Sign in
      </Link>{" "}
      to sort events by your interests.
    </>
  ) : selected.length ? (
    <>
      Sorted by your interests: <span className="font-semibold text-white">{selected.map(tagLabel).join(", ")}</span> ·{" "}
      <Link href="/settings#interests" className="font-semibold text-gold underline">
        Edit
      </Link>
    </>
  ) : (
    <>
      <Link href="/settings#interests" className="font-semibold text-gold underline">
        Choose your interests
      </Link>{" "}
      to see matching events first.
    </>
  );

  return (
    <div>
      <PageBand eyebrow="TroyLens" title="Discover student events" subtitle="Upcoming on-campus events published by student organizers.">
        <p className="mt-4 text-sm text-white/85">{interestsLine}</p>
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {problem && <Alert tone="warning">{problem}</Alert>}
        {!problem && listings.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-card p-8 text-center">
            <p className="font-display text-xl font-bold">No upcoming events yet</p>
            <p className="mt-1 text-sm text-muted">When organizers publish an event card from their plan, it shows up here.</p>
          </div>
        )}
        {listings.length > 0 && <DiscoverBrowser matches={matches} others={others} selected={selected} />}
      </div>
    </div>
  );
}
