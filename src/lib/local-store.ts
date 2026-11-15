"use client";
import { planDocSchema, type PlanDoc } from "./schema";

/**
 * LOCAL DEMO storage: this browser only. Not an account, not synced, and
 * never presented as cross-device persistence.
 */
const KEY = "evntsc:demo:plans";

export type LocalPlan = { id: string; doc: PlanDoc; isSample: boolean; updatedAt: string; version: number };

function readAll(): LocalPlan[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LocalPlan[];
    return arr.filter((p) => planDocSchema.safeParse(p.doc).success);
  } catch {
    return [];
  }
}

function writeAll(plans: LocalPlan[]) {
  window.localStorage.setItem(KEY, JSON.stringify(plans));
}

export const localStore = {
  list: () => readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  get: (id: string) => readAll().find((p) => p.id === id) ?? null,
  put(plan: LocalPlan) {
    const all = readAll().filter((p) => p.id !== plan.id);
    writeAll([...all, plan]);
  },
  remove(id: string) {
    writeAll(readAll().filter((p) => p.id !== id));
  },
  removeSamples() {
    writeAll(readAll().filter((p) => !p.isSample));
  },
};
