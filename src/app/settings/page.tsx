import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { InterestsForm } from "@/components/InterestsForm";
import { PrefsForm } from "@/components/PrefsForm";
import { PageBand } from "@/components/ui";
import { requireUser } from "@/lib/supabase/server";
import { troyLensEnabled } from "@/lib/troylens/card";

export const metadata: Metadata = { title: "Settings · EvntSC" };

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 id={`${id}-h`} className="flex items-center gap-2.5 font-display text-2xl font-bold">
        <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
        {title}
      </h2>
      {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const discover = troyLensEnabled();
  const prefs = { organization: user.prefs.organization, reminders: user.prefs.reminders, emailUpdates: user.prefs.emailUpdates };
  const nav: [string, string][] = [
    ["account", "Account"],
    ["organization", "Organization"],
    ["notifications", "Notifications"],
    ...(discover ? ([["interests", "Interests"]] as [string, string][]) : []),
    ["help", "Help & privacy"],
  ];
  return (
    <div>
      <PageBand eyebrow="Your account" title="Settings" subtitle="Your account, defaults for new plans, and how EvntSC keeps you posted." />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
            {nav.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block rounded-md border border-line-strong bg-card px-3 py-1.5 text-sm font-semibold hover:border-cardinal hover:text-cardinal lg:border-0 lg:border-l-[3px] lg:border-transparent lg:bg-transparent lg:hover:border-gold"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <Section id="account" title="Account">
            <dl className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
              <dt className="text-muted">Signed in as</dt>
              <dd className="font-semibold break-all">{user.email}</dd>
              <dt className="text-muted">Password</dt>
              <dd>
                <Link href="/reset-password" className="font-semibold text-cardinal underline">
                  Change password
                </Link>
              </dd>
            </dl>
          </Section>
          <Section id="organization" title="Organization" intro="EvntSC doesn’t verify officer roles; this only saves you typing.">
            <PrefsForm section="organization" initial={prefs} />
          </Section>
          <Section id="notifications" title="Notifications">
            <PrefsForm section="notifications" initial={prefs} />
          </Section>
          {discover && (
            <Section id="interests" title="Interests" intro="Used only to sort Discover. Change them any time.">
              <InterestsForm initial={user.interests} />
            </Section>
          )}
          <Section id="help" title="Help & privacy">
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["/help", "Help & resources", "How EvntSC works and which USC offices to contact."],
                ["/privacy", "Privacy & terms", "What’s stored, who can see it, and what EvntSC is not."],
              ].map(([href, t, d]) => (
                <li key={href}>
                  <Link href={href} className="block h-full rounded-lg border border-line-strong bg-white p-4 hover:border-cardinal">
                    <span className="block font-semibold">{t} →</span>
                    <span className="mt-0.5 block text-sm text-muted">{d}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
