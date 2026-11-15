"use client";
import { useState } from "react";
import { INTEREST_TAGS, type InterestTag } from "@/lib/troylens/card";
import { Alert, Button } from "./ui";

/** Interest toggles saved to the account; Discover sorts events by them. */
export function InterestsForm({ initial }: { initial: InterestTag[] }) {
  const [saved, setSaved] = useState<InterestTag[]>(initial);
  const [selected, setSelected] = useState<InterestTag[]>(initial);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = selected.length !== saved.length || selected.some((t) => !saved.includes(t));

  const toggle = (t: InterestTag) => {
    setStatus(null);
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  };

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/interests", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't save your interests. Try again.");
      setSaved(body.interests);
      setSelected(body.interests);
      setStatus({ tone: "success", text: "Saved. Discover now sorts events by these interests." });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Couldn't save your interests. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold">Your interests</legend>
      <p className="mt-1 text-sm text-muted">Discover puts events with these topics first.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {INTEREST_TAGS.map((t) => {
          const on = selected.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.id)}
                className={
                  on
                    ? "rounded-full border border-cardinal bg-cardinal px-3.5 py-1.5 text-sm font-semibold text-white"
                    : "rounded-full border border-line-strong bg-card px-3.5 py-1.5 text-sm font-semibold hover:border-cardinal"
                }
              >
                {on && <span aria-hidden className="mr-1 text-gold">✓</span>}
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save interests"}
        </Button>
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="text-sm text-muted underline">
            Clear all
          </button>
        )}
      </div>
      {status && (
        <div className="mt-3" role="status">
          <Alert tone={status.tone}>{status.text}</Alert>
        </div>
      )}
    </fieldset>
  );
}
