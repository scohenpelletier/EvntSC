import type { ReactNode } from "react";

/** Simple titled section for the static Help and Privacy pages. */
export function InfoSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-6 rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 id={id ? `${id}-h` : undefined} className="flex items-center gap-2.5 font-display text-2xl font-bold">
        <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}
