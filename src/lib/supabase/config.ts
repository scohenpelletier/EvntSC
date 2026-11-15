/** Supabase configuration. Only public (publishable/anon) values live here. */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) return null;
  return { url, key };
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;
