import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Plan not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been deleted, or it belongs to a different account.</p>
      <Link href="/plans" className="mt-4 inline-block rounded-md bg-cardinal px-4 py-2 text-sm font-semibold text-white">
        Back to My plans
      </Link>
    </div>
  );
}
