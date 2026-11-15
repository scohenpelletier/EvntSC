"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase(url: string, key: string) {
  return createBrowserClient(url, key);
}
