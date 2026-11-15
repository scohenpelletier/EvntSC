import Link from "next/link";
import { aiProviderLabel } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SetupPage() {
  const supa = isSupabaseConfigured();
  const ai = aiProviderLabel();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold">Server setup</h1>
      <ul className="mt-4 space-y-1 text-sm">
        <li>
          Accounts (Supabase): <strong className={supa ? "text-green" : "text-cardinal"}>{supa ? "configured" : "not configured"}</strong>
        </li>
        <li>
          AI assistance: <strong className={ai ? "text-green" : "text-amber"}>{ai ? `configured — ${ai}` : "not configured — manual mode"}</strong>
        </li>
      </ul>
      {!supa && (
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>
            Create a free project at <span className="font-mono">supabase.com</span>.
          </li>
          <li>
            In the SQL editor, run <span className="font-mono">supabase/migrations/0001_event_plans.sql</span> from this repository. It creates the
            table and its owner row-level-security policies.
          </li>
          <li>
            Under Authentication → URL Configuration, set Site URL to <span className="font-mono">http://localhost:3000</span> and add{" "}
            <span className="font-mono">http://localhost:3000/auth/callback</span> to Redirect URLs.
          </li>
          <li>Keep Email provider enabled with “Confirm email” on (recommended) for verification and password recovery.</li>
          <li>
            Copy <span className="font-mono">.env.example</span> to <span className="font-mono">.env.local</span> and fill in{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and <span className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>{" "}
            (Project Settings → API).
          </li>
          <li>Restart the dev server.</li>
        </ol>
      )}
      <div className="mt-8 rounded-lg border border-amber/40 bg-amber-wash p-4 text-sm">
        <p className="font-semibold">Local demo (no account)</p>
        <p className="mt-1">
          The demo stores plans only in this browser&apos;s local storage. It is not a signed-in account and does not sync between devices. Everything
          else — budget checks, cited checklist, revisions, export — works the same way.
        </p>
        <Link href="/demo" className="mt-3 inline-block rounded-md bg-ink px-4 py-2 font-medium text-white">
          Open local demo
        </Link>
      </div>
    </div>
  );
}
