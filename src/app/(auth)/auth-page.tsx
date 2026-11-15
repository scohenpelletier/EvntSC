import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { supabaseEnv } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

export async function AuthPage({ mode, notice }: { mode: "sign-in" | "sign-up" | "forgot" | "reset"; notice?: string | null }) {
  const env = supabaseEnv();
  if (!env) redirect("/setup");
  if (mode !== "reset" && (await getUser())) redirect("/plans");
  if (mode === "reset" && !(await getUser())) redirect("/forgot-password");
  return <AuthForm mode={mode} url={env.url} anonKey={env.key} notice={notice} />;
}
