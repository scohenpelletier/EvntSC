import Link from "next/link";
import { RemotePlanList } from "@/components/RemotePlanList";
import { StartPlanCard } from "@/components/StartPlanCard";
import { PageBand } from "@/components/ui";
import { aiConfigured } from "@/lib/ai";
import { listPlans } from "@/lib/plans-repo";
import { createClient, requireUser } from "@/lib/supabase/server";

export default async function PlansPage() {
  const user = await requireUser();
  const sb = await createClient();
  let plans: Awaited<ReturnType<typeof listPlans>> = [];
  let error: string | null = null;
  try {
    plans = await listPlans(sb);
  } catch (e) {
    error = e instanceof Error && /relation .* does not exist|event_plans/.test(e.message)
      ? "The database table is missing. Run supabase/migrations/0001_event_plans.sql in your Supabase project."
      : "Could not load your plans. Refresh to try again.";
  }
  const flyer = aiConfigured();
  return (
    <div>
      <PageBand
        eyebrow={user.prefs.organization || user.email}
        title="My plans"
        subtitle="Pick up where you left off, or start a new event plan."
        actions={
          <>
            {flyer && (
              <Link href="/plans/new/flyer" className="rounded-md border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Start from a flyer
              </Link>
            )}
            <Link href="/plans/new" className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-cardinal-deep hover:bg-gold-soft">
              + Plan an event
            </Link>
          </>
        }
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_360px]">
        <div>
          {error ? (
            <p role="alert" className="rounded-md border border-cardinal/40 bg-cardinal-wash p-3 text-sm">
              {error}
            </p>
          ) : (
            <RemotePlanList
              plans={plans.map((p) => ({ id: p.id, title: p.title, date: p.date, isSample: p.is_sample, updatedAt: p.updated_at, href: `/plans/${p.id}` }))}
            />
          )}
        </div>
        <aside className="space-y-5">
          <StartPlanCard base="/plans/new" flyer={flyer} />
          <div className="on-cardinal rounded-xl bg-cardinal-deep p-5 text-white">
            <p className="font-semibold">Private to your account</p>
            <p className="mt-1 text-sm text-white/80">Only you can open, edit, export or delete these plans. Nothing is submitted to USC.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
