"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isUscEmail } from "@/lib/usc-email";
import { Alert, Button, TextField } from "./ui";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; cta: string }> = {
  "sign-in": { title: "Sign in", cta: "Sign in" },
  "sign-up": { title: "Create your account", cta: "Create account" },
  forgot: { title: "Reset your password", cta: "Send reset link" },
  reset: { title: "Choose a new password", cta: "Update password" },
};

export function AuthForm({ mode, url, anonKey, notice }: { mode: Mode; url: string; anonKey: string; notice?: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(url, anonKey), [url, anonKey]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (mode === "sign-up" && !isUscEmail(email)) {
      setError("Use your USC email address (ending in usc.edu).");
      return;
    }
    if ((mode === "sign-up" || mode === "reset") && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    const origin = window.location.origin;
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/plans");
        router.refresh();
        return;
      }
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback?next=/welcome` } });
        if (error) throw error;
        if (data.session) {
          router.replace("/welcome");
        router.refresh();
          return;
        }
        setDone("Check your inbox to verify your email, then sign in.");
      }
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
        if (error) throw error;
        setDone("If an account exists for that email, a reset link is on its way.");
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setDone("Password updated. Redirecting…");
        router.replace("/plans");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-200px)] lg:grid-cols-[minmax(0,620px)_1fr]">
      <aside className="on-cardinal hidden bg-cardinal px-12 py-16 text-white lg:block xl:px-16">
        <h2 className="font-display text-5xl leading-tight">{mode === "sign-up" ? "Plan it. Check it. Keep it." : "Welcome back."}</h2>
        <p className="mt-5 max-w-md text-lg text-white/85">
          Your plans are saved to your account, so the same plan is here after a refresh or on another device.
        </p>
        <span aria-hidden className="mt-8 block h-1 w-14 rounded-full bg-gold" />
        <ul className="mt-8 space-y-4 text-[15px] text-white/90">
          {[
            "Accounts keep your plans private to you.",
            "Requirements cite official USC pages. EvntSC does not verify officer roles.",
            "Export a planning packet any time — a prep document, not an application.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-cardinal-deep">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </aside>
    <div className="mx-auto w-full max-w-md self-center px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">{COPY[mode].title}</h1>
      <p className="mt-2 text-sm text-muted">Accounts keep your plans private to you. EvntSC does not verify officer roles.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {notice && <Alert tone="info">{notice}</Alert>}
        {mode !== "reset" && (
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === "sign-up" ? "you@usc.edu" : undefined}
            hint={mode === "sign-up" ? "Must be a usc.edu address." : undefined}
          />
        )}
        {mode !== "forgot" && (
          <TextField
            label={mode === "reset" ? "New password" : "Password"}
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === "sign-up" || mode === "reset" ? "At least 8 characters." : undefined}
          />
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {done && <Alert tone="success">{done}</Alert>}
        <Button type="submit" variant="primary" className="w-full py-2.5 text-[15px]" disabled={busy}>
          {busy ? "Working…" : COPY[mode].cta}
        </Button>
      </form>
      <div className="mt-6 space-y-1 text-sm">
        {mode === "sign-in" && (
          <>
            <p>
              New here?{" "}
              <Link className="font-medium text-cardinal underline" href="/sign-up">
                Create an account
              </Link>
            </p>
            <p>
              <Link className="text-muted underline" href="/forgot-password">
                Forgot your password?
              </Link>
            </p>
          </>
        )}
        {mode !== "sign-in" && (
          <p>
            <Link className="font-medium text-cardinal underline" href="/sign-in">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
    </div>
  );
}
