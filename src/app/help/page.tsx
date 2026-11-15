import type { Metadata } from "next";
import Link from "next/link";
import { InfoSection } from "@/components/InfoPage";
import { PageBand } from "@/components/ui";
import { RESOURCES, RESOURCES_REVIEWED_ON } from "@/lib/resources";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Help & resources · EvntSC" };

const STEPS: [string, string][] = [
  ["Describe or upload", "Write a sentence or two, start from a flyer, or fill in the form. Anything you don’t know stays Unknown."],
  ["Review the proposal", "When AI is on, it only proposes values. You accept or reject each one before it’s applied."],
  ["Work the checklist", "Tasks come from rules that cite official USC pages. Target dates are planning suggestions, not official deadlines."],
  ["Check the budget", "Totals use exact cent math from your own numbers. Missing costs are shown as unknown, never guessed."],
  ["Export the packet", "Print or download a planning packet to share with officers or an advisor. It is not an application."],
];

export default function HelpPage() {
  const offices = Object.values(RESOURCES);
  return (
    <div>
      <PageBand eyebrow="Help" title="Help & resources" subtitle="How EvntSC works, and who at USC actually approves things." />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <InfoSection id="how" title="How EvntSC works">
          <ol className="space-y-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cardinal text-sm font-bold text-gold">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold">{t}.</span> <span className="text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </InfoSection>
        <InfoSection id="limits" title="What EvntSC can’t do">
          <p>
            EvntSC can’t book rooms, submit funding applications, approve events, or confirm availability. It doesn’t verify that you are an officer of
            an organization. Always confirm requirements with the office listed on each task.
          </p>
          <p className="text-muted">Scope: basic on-campus workshops and information sessions.</p>
        </InfoSection>
        <InfoSection id="offices" title="USC offices & services">
          <p className="text-sm text-muted">Details were copied from each office’s official page, last reviewed {formatDate(RESOURCES_REVIEWED_ON)}.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {offices.map((r) => (
              <li key={r.id} className="rounded-lg border border-line-strong bg-white p-4">
                <p className="font-display text-lg font-bold">{r.name}</p>
                <p className="mt-1 text-sm text-muted">{r.role}</p>
                <p className="mt-2 space-x-3 text-sm">
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="font-semibold text-cardinal underline">
                      {r.email}
                    </a>
                  )}
                  {r.phone && <span>{r.phone}</span>}
                </p>
                <a href={r.contactPage ?? r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-cardinal underline">
                  Official page<span className="sr-only"> (opens in a new tab)</span> →
                </a>
              </li>
            ))}
          </ul>
        </InfoSection>
        <p className="text-sm text-muted">
          Questions about your data? See{" "}
          <Link href="/privacy" className="font-semibold text-cardinal underline">
            Privacy & terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
