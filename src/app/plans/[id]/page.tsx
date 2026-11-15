import { notFound } from "next/navigation";
import { Workspace } from "@/components/Workspace";
import { aiConfigured } from "@/lib/ai";
import { getPlan, rowToDoc } from "@/lib/plans-repo";
import { createClient, requireUser } from "@/lib/supabase/server";
import { troyLensEnabled, type Listing } from "@/lib/troylens/card";
import { getListing, isMissingTable } from "@/lib/troylens/repo";

export default async function PlanPage({ params }: PageProps<"/plans/[id]">) {
  await requireUser();
  const { id } = await params;
  const sb = await createClient();
  const row = await getPlan(sb, id);
  // RLS returns nothing for another user's plan, so it is indistinguishable from a missing one.
  if (!row) notFound();
  const doc = rowToDoc(row);
  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert">This plan&apos;s saved data could not be read. It has not been modified.</p>
      </div>
    );
  }
  // Optional TroyLens extension: a failure here never blocks the plan itself.
  let troyLens: { listing: Listing | null; unavailable?: string } | undefined;
  if (troyLensEnabled()) {
    try {
      troyLens = { listing: await getListing(sb, row.id) };
    } catch (e) {
      troyLens = {
        listing: null,
        unavailable: isMissingTable(e)
          ? "The event-card table isn’t set up yet. Run supabase/migrations/0002_event_listings.sql in the Supabase SQL editor."
          : "Couldn’t load the event card right now. Your plan is unaffected.",
      };
    }
  }
  return (
    <Workspace
      troyLens={troyLens}
      initial={doc}
      mode={{ kind: "remote", id: row.id, version: row.version, updatedAt: row.updated_at }}
      isSample={row.is_sample}
      aiEnabled={aiConfigured()}
    />
  );
}
