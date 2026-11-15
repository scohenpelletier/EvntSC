import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID_RE } from "../plans-repo";
import { LISTING_COLUMNS, rowToListing, type Listing, type ListingRow } from "./card";

/** Public listings. Reads work for anyone; writes are limited by RLS to the plan's owner. */

export async function getListing(sb: SupabaseClient, id: string): Promise<Listing | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await sb.from("event_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToListing(data as unknown as ListingRow) : null;
}

/**
 * Cards for Discover: the last ~4 months (past events are useful as ideas) plus everything upcoming or TBA.
 */
export async function listForDiscover(sb: SupabaseClient, today: string): Promise<Listing[]> {
  const since = new Date(Date.parse(today + "T12:00:00Z") - 120 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("event_listings")
    .select(LISTING_COLUMNS)
    .or(`event_date.gte.${since},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data as unknown as ListingRow[]).map(rowToListing);
}

/** Upcoming and TBA listings. Past events are filtered in SQL so the page never loads them. */
export async function listUpcoming(sb: SupabaseClient, today: string): Promise<Listing[]> {
  const { data, error } = await sb
    .from("event_listings")
    .select(LISTING_COLUMNS)
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as unknown as ListingRow[]).map(rowToListing);
}

export async function upsertListing(sb: SupabaseClient, cols: Record<string, unknown>): Promise<Listing> {
  const { data, error } = await sb.from("event_listings").upsert(cols, { onConflict: "id" }).select(LISTING_COLUMNS).single();
  if (error) throw new Error(error.message);
  return rowToListing(data as unknown as ListingRow);
}

export async function deleteListing(sb: SupabaseClient, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const { data, error } = await sb.from("event_listings").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** True when the migration hasn't been run yet (PostgREST: relation not in schema cache). */
export function isMissingTable(e: unknown): boolean {
  return e instanceof Error && /event_listings|schema cache|does not exist/i.test(e.message);
}
