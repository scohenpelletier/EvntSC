export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading…</p>
      <div className="h-8 w-48 animate-pulse rounded bg-line" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-line/60" />
        ))}
      </div>
    </div>
  );
}
