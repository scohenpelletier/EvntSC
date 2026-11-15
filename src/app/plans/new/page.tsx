import { NewPlan } from "@/components/NewPlan";
import { aiConfigured } from "@/lib/ai";
import { createClient, requireUser } from "@/lib/supabase/server";
import { troyLensEnabled } from "@/lib/troylens/card";
import { seedFromListing } from "@/lib/troylens/discover";
import { getListing } from "@/lib/troylens/repo";

/** `?like=<listing id>` comes from "Plan something like this" on Discover. */
export default async function NewPlanPage({ searchParams }: PageProps<"/plans/new">) {
  const user = await requireUser();
  const like = (await searchParams).like;
  const listing = troyLensEnabled() && typeof like === "string" ? await getListing(await createClient(), like).catch(() => null) : null;
  const seed = listing ? seedFromListing(listing, user.prefs.organization) : undefined;
  return <NewPlan storage="remote" aiEnabled={aiConfigured()} defaultOrganization={user.prefs.organization} seed={seed} />;
}
