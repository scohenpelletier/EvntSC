"use client";
import { kindsForResource, type RelevantResource } from "@/lib/outreach";
import type { Resource } from "@/lib/resources";
import type { Draft } from "@/lib/schema";
import { Button, Card } from "./ui";

const KIND_LABEL: Record<Resource["kind"], string> = {
  venue: "Venue",
  catering: "Catering",
  campus_office: "Campus office",
  accessibility: "Accessibility",
};


export function ContactsPanel({
  items,
  onDraft,
  onGotoTask,
}: {
  items: RelevantResource[];
  onDraft: (kind: Draft["kind"], resourceId: string | null, taskId: string | null) => void;
  onGotoTask: (taskId: string) => void;
}) {
  return (
    <div className="space-y-5">
      {items.length > 0 && (
        <div className="on-cardinal flex items-center gap-4 rounded-xl bg-cardinal-deep px-5 py-4 text-white">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-cardinal-deep">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </span>
          <div>
            <p className="font-display text-lg font-bold">
              {items.length} office{items.length === 1 ? "" : "s"} for this plan
            </p>
            <p className="text-sm text-white/80">Contacts appear when a checklist task needs them. EvntSC never sends anything — verify, then send from your own email.</p>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No campus contacts match the plan yet. Add a venue, food, or guests in Edit details and relevant offices will appear here.
        </p>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {items.map(({ resource: r, reasons }) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-cardinal">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />
                  {KIND_LABEL[r.kind]}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold leading-snug">{r.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {reasons[0] && (
                    <button type="button" className="text-left hover:text-ink hover:underline" onClick={() => onGotoTask(reasons[0].taskId)}>
                      For: {reasons[0].title}
                      {reasons.length > 1 ? ` +${reasons.length - 1}` : ""}
                    </button>
                  )}
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="block font-medium text-cardinal underline">
                      {r.email}
                    </a>
                  ) : (
                    <p className="inline-block rounded-md bg-amber-wash px-2.5 py-1 font-medium text-amber">Email needs verification</p>
                  )}
                  {r.phone && (
                    <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="block">
                      {r.phone}
                    </a>
                  )}
                </div>
                <div className="flex-1" />
                <Button size="sm" variant="primary" className="mt-4 self-start" onClick={() => onDraft(kindsForResource(r)[0], r.id, reasons[0]?.taskId ?? null)}>
                  Draft email
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
