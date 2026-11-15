import Link from "next/link";
import { redirect } from "next/navigation";
import { Tag } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

const FEATURES: [string, string, string][] = [
  ["01", "Budget checks you can trust", "Integer-cent math, known subtotals when costs are missing, and warnings that come from your own numbers."],
  ["02", "Straight to the point", "Just what your event needs, with a link to the right USC office. Gaps stay open questions."],
  ["03", "Revise without losing work", "Change the date or budget and see exactly which tasks need a recheck. Your notes stay put."],
];

/** Static, clearly fictional preview of what a plan surfaces. Not live data. */
function PlanPreview() {
  return (
    <div aria-hidden className="w-full max-w-[480px] rounded-2xl bg-card p-6 text-ink shadow-[0_18px_40px_rgba(26,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-bold">[Sample] Founder Speaker Night</p>
        <Tag tone="gold">Fictional</Tag>
      </div>
      <div className="mt-4 rounded-lg bg-cardinal px-4 py-3.5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Budget</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-3xl">$30.00</span>
          <span className="text-sm font-semibold text-gold">over budget</span>
        </p>
        <p className="mt-1 text-xs text-white/85">Known costs $630.00 vs. your $600.00 budget · 1 cost still unknown</p>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-paper px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Request event space through TES</p>
          <Tag tone="cardinal">Verified requirement</Tag>
        </div>
        <p className="mt-1.5 font-display text-sm italic text-muted">“Recognized Student Organizations in good standing can request to book space on campus.”</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-blue-wash px-4 py-3">
        <p className="text-sm font-semibold">Submit the USG funding application on time</p>
        <Tag tone="blue">Needs confirmation</Tag>
      </div>
    </div>
  );
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  if (configured && (await getUser())) redirect("/plans");
  return (
    <div>
      <section className="on-cardinal bg-cardinal text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">For USC student organizers</p>
            <h1 className="mt-4 max-w-3xl font-display text-[42px] leading-[1.05] sm:text-6xl lg:text-[72px]">Turn a workshop idea into a plan you can actually check.</h1>
            <p className="mt-6 max-w-2xl text-lg text-white/88">
              Describe your on-campus workshop or info session. EvntSC checks your budget arithmetic, lists the requirements it can cite from
              official USC pages, keeps unknowns visible as questions, and exports a planning packet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {configured ? (
                <>
                  <Link href="/sign-up" className="rounded-md bg-gold px-5 py-3 font-bold text-cardinal-deep hover:bg-gold-soft">
                    Create an account
                  </Link>
                  <Link href="/sign-in" className="rounded-md border border-white/70 px-5 py-3 font-semibold text-white hover:bg-white/10">
                    Sign in
                  </Link>
                  <Link href="/demo" className="px-2 py-3 text-sm font-semibold text-gold underline hover:no-underline">
                    or try the local demo →
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/setup" className="rounded-md bg-gold px-5 py-3 font-bold text-cardinal-deep hover:bg-gold-soft">
                    Set up accounts
                  </Link>
                  <Link href="/demo" className="rounded-md border border-white/70 px-5 py-3 font-semibold text-white hover:bg-white/10">
                    Try the local demo
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden lg:block">
            <PlanPreview />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <ul className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map(([n, t, d]) => (
            <li key={t} className="rounded-xl border border-line bg-card p-6 sm:p-7">
              <p className="font-display text-5xl text-cardinal">{n}</p>
              <span aria-hidden className="mt-3 block h-1 w-10 rounded-full bg-gold" />
              <h2 className="mt-4 font-display text-xl font-bold">{t}</h2>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
        <div className="on-cardinal mt-10 flex flex-col gap-3 rounded-xl bg-cardinal-deep px-6 py-5 text-white sm:flex-row sm:items-center sm:gap-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Scope</p>
          <p className="text-sm">Basic on-campus workshops and information sessions.</p>
          <p className="text-sm text-white/80 sm:ml-auto">EvntSC cannot book rooms, submit funding applications, or approve events.</p>
        </div>
      </div>
    </div>
  );
}
