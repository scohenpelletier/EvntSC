"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearPrivateClientState } from "@/lib/client-state";

export function AccountMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    setError(null);
    let ok = false;
    try {
      const res = await fetch("/auth/signout", { method: "POST" });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      // Don't pretend: the session may still be active. Stay here and offer a retry.
      setBusy(false);
      setError("Sign-out didn't complete. You're still signed in — try again.");
      return;
    }
    clearPrivateClientState();
    // Full navigation drops the client router cache, so no plan data lingers in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard reload on sign-out
    window.location.assign("/sign-in?signedOut=1");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Account menu${email ? ` for ${email}` : ""}`}
        className="flex items-center gap-2 rounded-full border border-gold/50 bg-cardinal-ink py-1 pr-1 pl-1 text-sm font-medium text-white hover:border-gold sm:pr-3"
      >
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-cardinal-deep">
          {(email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[18ch] truncate sm:inline">{email ?? "Account"}</span>
        <svg aria-hidden className="hidden text-gold sm:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-line bg-card p-1 text-ink shadow-xl">
          <p className="truncate border-b border-line px-3 py-2.5 text-xs text-muted">
            Signed in as <span className="font-semibold text-ink">{email}</span>
          </p>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-paper">
            Settings
          </Link>
          <button role="menuitem" type="button" disabled={busy} onClick={signOut} className="w-full rounded px-3 py-2 text-left text-sm font-medium text-cardinal hover:bg-paper">
            {busy ? "Signing out…" : error ? "Try signing out again" : "Sign out"}
          </button>
          {error && (
            <p role="alert" className="px-3 pb-2 text-xs text-cardinal">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
