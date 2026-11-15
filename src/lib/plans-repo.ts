import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planDocSchema, type PlanDoc } from "./schema";

/**
 * Data access for event plans. Every call uses the caller's cookie-bound
 * Supabase client, so Postgres RLS enforces ownership. owner_id is set from the
 * verified server identity, never from the request body.
 */

export type PlanRow = {
  id: string;
  owner_id: string;
  title: string;
  is_sample: boolean;
  intake: unknown;
  budget: unknown;
  tasks: unknown;
  questions: unknown;
  ai_notes: unknown;
  version: number;
  created_at: string;
  updated_at: string;
};

export type PlanSummary = Pick<PlanRow, "id" | "title" | "is_sample" | "updated_at" | "version"> & { date: string | null };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Planner data added after the original schema (assumptions, outreach drafts,
 * change log) is stored inside the intake jsonb under WORKSPACE_KEY, so no
 * database migration is needed. intakeSchema strips the key when parsing.
 */
const WORKSPACE_KEY = "_workspace";

export function rowToDoc(row: PlanRow): PlanDoc | null {
  const ws = (row.intake && typeof row.intake === "object" ? (row.intake as Record<string, unknown>)[WORKSPACE_KEY] : null) as Record<string, unknown> | null;
  const parsed = planDocSchema.safeParse({
    assumptions: ws?.assumptions ?? [],
    drafts: ws?.drafts ?? [],
    changeLog: ws?.changeLog ?? [],
    intake: row.intake,
    budget: row.budget,
    tasks: row.tasks,
    questions: row.questions,
    aiNotes: row.ai_notes ?? [],
  });
  return parsed.success ? parsed.data : null;
}

function docColumns(doc: PlanDoc) {
  return {
    title: doc.intake.title.slice(0, 160),
    intake: { ...doc.intake, [WORKSPACE_KEY]: { assumptions: doc.assumptions, drafts: doc.drafts, changeLog: doc.changeLog } },
    budget: doc.budget,
    tasks: doc.tasks,
    questions: doc.questions,
    ai_notes: doc.aiNotes,
  };
}

export async function listPlans(sb: SupabaseClient): Promise<PlanSummary[]> {
  const { data, error } = await sb
    .from("event_plans")
    .select("id,title,is_sample,updated_at,version,intake->>date")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    is_sample: r.is_sample as boolean,
    updated_at: r.updated_at as string,
    version: r.version as number,
    date: (r.date as string | null) ?? null,
  }));
}

export async function getPlan(sb: SupabaseClient, id: string): Promise<PlanRow | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await sb.from("event_plans").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlanRow) ?? null;
}

export async function createPlan(sb: SupabaseClient, ownerId: string, doc: PlanDoc, isSample = false): Promise<PlanRow> {
  const { data, error } = await sb
    .from("event_plans")
    .insert({ ...docColumns(doc), owner_id: ownerId, is_sample: isSample })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PlanRow;
}

export type SaveResult = { kind: "ok"; row: PlanRow } | { kind: "conflict"; currentVersion: number } | { kind: "not_found" };

export async function savePlan(sb: SupabaseClient, id: string, expectedVersion: number, doc: PlanDoc): Promise<SaveResult> {
  if (!UUID_RE.test(id)) return { kind: "not_found" };
  const { data, error } = await sb
    .from("event_plans")
    .update(docColumns(doc))
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return { kind: "ok", row: data as PlanRow };
  const current = await getPlan(sb, id);
  if (!current) return { kind: "not_found" };
  return { kind: "conflict", currentVersion: current.version };
}

export async function deletePlan(sb: SupabaseClient, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const { data, error } = await sb.from("event_plans").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function deleteSamples(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.from("event_plans").delete().eq("is_sample", true).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
