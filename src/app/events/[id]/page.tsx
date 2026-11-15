import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { troyLensEnabled } from "@/lib/troylens/card";
import { getListing } from "@/lib/troylens/repo";

export const metadata: Metadata = { title: "Event · EvntSC" };

/** Public page for one published card. Reads only event_listings — never the private plan. */
export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  if (!troyLensEnabled() || !isSupabaseConfigured()) notFound();
  const { id } = await params;
  const listing = await getListing(await createClient(), id).catch(() => null);
  if (!listing) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/discover" className="hover:underline">
          Discover
        </Link>{" "}
        / <span>Event</span>
      </nav>
      <EventCard card={listing} headingLevel="h2" className="mt-3 p-6" />
      <p className="mt-4 text-xs text-muted">
        Published by the organizer through EvntSC. Details can change — check with the organizer before you go. EvntSC is not affiliated with or
        endorsed by USC.
      </p>
    </div>
  );
}
