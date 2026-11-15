"use client";
import { useState } from "react";
import type { Prefs } from "@/lib/prefs";
import { Alert, Button, TextField } from "./ui";

type Editable = Pick<Prefs, "organization" | "reminders" | "emailUpdates">;

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const res = await fetch("/api/settings/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't save your settings. Try again.");
  return body.prefs as Prefs;
}

function Switch({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div>
        <p id={`${id}-l`} className="font-semibold">
          {label}
        </p>
        <p id={`${id}-h`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={`${id}-h`}
        onClick={() => onChange(!checked)}
        className={"relative h-7 w-12 shrink-0 rounded-full transition-colors " + (checked ? "bg-cardinal" : "bg-line-strong")}
      >
        <span
          aria-hidden
          className={"absolute top-1 h-5 w-5 rounded-full shadow transition-all " + (checked ? "left-6 bg-gold" : "left-1 bg-white")}
        />
      </button>
    </div>
  );
}

/** Organization default and notification preferences, saved to the account. */
export function PrefsForm({ initial, section }: { initial: Editable; section: "organization" | "notifications" }) {
  const [saved, setSaved] = useState<Editable>(initial);
  const [v, setV] = useState<Editable>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const keys: (keyof Editable)[] = section === "organization" ? ["organization"] : ["reminders", "emailUpdates"];
  const dirty = keys.some((k) => (typeof v[k] === "string" ? (v[k] as string).trim() : v[k]) !== saved[k]);
  const set = (patch: Partial<Editable>) => {
    setStatus(null);
    setV((x) => ({ ...x, ...patch }));
  };

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, typeof v[k] === "string" ? (v[k] as string).trim() : v[k]]));
      const p = await savePrefs(patch);
      const next = { organization: p.organization, reminders: p.reminders, emailUpdates: p.emailUpdates };
      setSaved(next);
      setV(next);
      setStatus({
        tone: "success",
        text: section === "organization" ? "Saved. New plans start with this organization." : "Saved to your account.",
      });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Couldn't save your settings. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {section === "organization" ? (
        <TextField
          label="Default organization"
          hint="Filled into new plans. You can change it on any plan."
          value={v.organization}
          maxLength={120}
          onChange={(e) => set({ organization: e.target.value })}
          placeholder="e.g. Trojan Founders Club"
        />
      ) : (
        <>
          <Switch
            id="pref-reminders"
            label="Planning reminders"
            hint="A reminder a few days before each organizer target date."
            checked={v.reminders}
            onChange={(reminders) => set({ reminders })}
          />
          <Switch
            id="pref-updates"
            label="Weekly email update"
            hint="A short summary of open checklist items and unknown costs."
            checked={v.emailUpdates}
            onChange={(emailUpdates) => set({ emailUpdates })}
          />
          <p className="mt-1 rounded-md bg-blue-wash px-3 py-2 text-sm">
            EvntSC doesn’t send emails yet. Your choice is saved to your account so it’s ready when notifications launch.
          </p>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {status && (
        <div className="mt-3" role="status">
          <Alert tone={status.tone}>{status.text}</Alert>
        </div>
      )}
    </div>
  );
}
