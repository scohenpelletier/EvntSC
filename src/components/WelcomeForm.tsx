"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { INTEREST_TAGS, type InterestTag } from "@/lib/troylens/card";
import { savePrefs } from "./PrefsForm";
import { Alert, Button, TextField } from "./ui";

/** First-run screen after sign-up: optional organization and Discover interests. Everything can be skipped. */
export function WelcomeForm({ initialInterests, initialOrg, discover }: { initialInterests: InterestTag[]; initialOrg: string; discover: boolean }) {
  const router = useRouter();
  const [org, setOrg] = useState(initialOrg);
  const [selected, setSelected] = useState<InterestTag[]>(initialInterests);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(save: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (save && discover) {
        const res = await fetch("/api/settings/interests", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ interests: selected }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save your interests.");
      }
      await savePrefs(save ? { organization: org.trim(), onboarded: true } : { onboarded: true });
      router.replace("/plans");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again, or skip for now.");
      setBusy(false);
    }
  }

  const toggle = (t: InterestTag) => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
        <h2 className="font-display text-2xl font-bold">Who are you planning for?</h2>
        <p className="mt-1 text-sm text-muted">Optional. New plans start with this organization; EvntSC doesn’t verify officer roles.</p>
        <TextField className="mt-4" label="Organization" value={org} maxLength={120} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Trojan Founders Club" />
      </section>
      {discover && (
        <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
          <h2 className="font-display text-2xl font-bold">What are you into?</h2>
          <p className="mt-1 text-sm text-muted">Pick a few topics. Discover shows related clubs&apos; events first. Change them any time in Settings.</p>
          <div role="group" aria-label="Interests" className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {INTEREST_TAGS.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={
                    "flex items-center justify-between rounded-lg border-[1.5px] px-3.5 py-3 text-left text-sm font-semibold transition-colors " +
                    (on ? "border-cardinal bg-cardinal text-white" : "border-line-strong bg-white hover:border-cardinal")
                  }
                >
                  {t.label}
                  <span
                    aria-hidden
                    className={"flex h-5 w-5 items-center justify-center rounded-full text-xs " + (on ? "bg-gold text-cardinal-deep" : "border border-line-strong")}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            {selected.length ? `${selected.length} selected` : "None selected yet"}
          </p>
        </section>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => finish(true)} disabled={busy} className="px-6 py-2.5 text-[15px]">
          {busy ? "Saving…" : "Continue to my plans"}
        </Button>
        <button type="button" onClick={() => finish(false)} disabled={busy} className="text-sm font-semibold text-muted underline hover:text-ink">
          Skip for now
        </button>
      </div>
    </div>
  );
}
