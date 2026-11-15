import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoverHub } from "@/components/DiscoverHub";
import { Alert, PageBand } from "@/components/ui";
import { campusToday } from "@/lib/dates";
import { listPlans } from "@/lib/plans-repo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient, getUser } from "@/lib/supabase/server";
import { tagLabel, troyLensEnabled, type Listing } from "@/lib/troylens/card";
import { aroundDates, clubs, ideas, type PlanDate } from "@/lib/troylens/discover";
import { isMissingTable, listForDiscover } from "@/lib/troylens/repo";

export const metadata: Metadata = { title: "Discover · EvntSC" };

/**
 * Discover for club officers: what other clubs are doing, to answer "What could our club host?",
 * "What else is happening around our date?" and "Who could we collaborate with?".
 * Only public event cards are read; the officer's own plans (RLS-scoped) are used for date comparisons.
 */
export default async function DiscoverPage() {
  if (!troyLensEnabled()) notFound();
  const user = await getUser();
  const interests = user?.interests ?? [];
  const today = campusToday();

  let listings: Listing[] = [];
  let plans: PlanDate[] = [];
  let problem: string | null = null;
  if (!isSupabaseConfigured()) problem = "Accounts aren't configured on this server, so there are no published events to show.";
  else {
    try {
      const sb = await createClient();
      listings = await listForDiscover(sb, today);
      if (user) plans = (await listPlans(sb).catch(() => [])).map((p) => ({ id: p.id, title: p.title, date: p.date }));
    } catch (e) {
      problem = isMissingTable(e)
        ? "Event cards aren't set up on this server yet (run supabase/migrations/0002_event_listings.sql)."
        : "Couldn't load events right now. Try again in a moment.";
    }
  }
  const ownIds = plans.map((p) => p.id);
  const ideaList = ideas(listings.filter((l) => !ownIds.includes(l.id)), interests, today);

  return (
    <div>
      <PageBand eyebrow="For club officers" title="See what other clubs are doing" subtitle="Find ideas, check what's happening around your dates, and spot clubs to team up with.">
        <p className="mt-4 text-sm text-white/85">
          {!user ? (
            <>
              <Link href="/sign-in" className="font-semibold text-gold underline">
                Sign in
              </Link>{" "}
              to compare with your own plans.
            </>
          ) : interests.length ? (
            <>
              Your interests: <span className="font-semibold text-white">{interests.map(tagLabel).join(", ")}</span> ·{" "}
              <Link href="/settings#interests" className="font-semibold text-gold underline">
                Edit
              </Link>
            </>
          ) : (
            <>
              <Link href="/settings#interests" className="font-semibold text-gold underline">
                Choose your club&apos;s interests
              </Link>{" "}
              to see related clubs first.
            </>
          )}
        </p>
      </PageBand>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {problem && <Alert tone="warning">{problem}</Alert>}
        {!problem && listings.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-card p-8 text-center">
            <p className="font-display text-xl font-bold">No shared events yet</p>
            <p className="mt-1 text-sm text-muted">When officers share an event from their plan, it shows up here.</p>
          </div>
        )}
        {!problem && listings.length > 0 && (
          <DiscoverHub
            ideas={ideaList}
            around={aroundDates(listings, plans, interests, today)}
            clubs={clubs(listings, interests, today, ownIds)}
            signedIn={!!user}
            hasPlans={plans.length > 0}
          />
        )}
      </div>
    </div>
  );
}
