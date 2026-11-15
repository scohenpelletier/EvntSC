import Link from "next/link";

const OPTIONS: { href: string; title: string; body: string; icon: React.ReactNode }[] = [
  {
    href: "",
    title: "Describe it",
    body: "A sentence or two. EvntSC proposes fields; you review each one.",
    icon: <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />,
  },
  {
    href: "/flyer",
    title: "Start from a flyer",
    body: "Upload or snap a photo. Details are read as a proposal — never assumed.",
    icon: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
  },
  {
    href: "#details",
    title: "Fill the form",
    body: "Works without AI. Leave anything you don’t know as Unknown.",
    icon: <path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />,
  },
];

/** Sidebar listing the three ways to start a plan. `base` is /plans/new or /demo/new. */
export function StartPlanCard({ base, flyer }: { base: string; flyer: boolean }) {
  return (
    <section aria-labelledby="start-h" className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 id="start-h" className="flex items-center gap-2.5 font-display text-xl font-bold">
        <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
        Start a plan
      </h2>
      <p className="mt-2 text-sm text-muted">One kind of event, done well: an on-campus workshop or information session.</p>
      <ul className="mt-4 space-y-2.5">
        {OPTIONS.filter((o) => flyer || o.href !== "/flyer").map((o) => (
          <li key={o.title}>
            <Link href={`${base}${o.href}`} className="flex items-start gap-3 rounded-lg border border-line-strong bg-white p-3.5 hover:border-cardinal">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cardinal text-gold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {o.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-xs text-muted">{o.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
