"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localStore, type LocalPlan } from "@/lib/local-store";
import { SAMPLES } from "@/lib/samples";
import { newId } from "@/lib/schema";
import { PlanList } from "./PlanList";
import { PageBand } from "./ui";
import { Workspace } from "./Workspace";

function DemoBanner() {
  return null;
}

function useMounted() {
  const [m, setM] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  useEffect(() => setM(true), []);
  return m;
}

export function DemoList() {
  const mounted = useMounted();
  const [plans, setPlans] = useState<LocalPlan[]>([]);
  const refresh = () => setPlans(localStore.list());
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
  useEffect(() => refresh(), []);
  if (!mounted) return null;
  return (
    <>
      <DemoBanner />
      <PageBand
        eyebrow="Local demo · this browser only"
        title="Local demo plans"
        subtitle="Plans here are saved in this browser, not to an account. Clearing site data removes them."
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div>
          <PlanList
            plans={plans.map((p) => ({ id: p.id, title: p.doc.intake.title, date: p.doc.intake.date, isSample: p.isSample, updatedAt: p.updatedAt, href: `/demo/${p.id}` }))}
            newHref="/demo/new"
            onDelete={async (id) => {
              localStore.remove(id);
              refresh();
            }}
            onLoadSamples={async () => {
              localStore.removeSamples();
              for (const s of SAMPLES) localStore.put({ id: newId("demo-"), doc: structuredClone(s.doc), isSample: true, updatedAt: new Date().toISOString(), version: 1 });
              refresh();
            }}
            onResetSamples={async () => {
              localStore.removeSamples();
              refresh();
            }}
          />
        </div>
      </div>
    </>
  );
}

export function DemoPlan({ id, aiEnabled }: { id: string; aiEnabled: boolean }) {
  const mounted = useMounted();
  if (!mounted) return null;
  const plan = localStore.get(id);
  if (!plan) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Plan not found in this browser</h1>
        <Link href="/demo" className="mt-4 inline-block underline">
          Back to local demo plans
        </Link>
      </div>
    );
  }
  return (
    <>
      <DemoBanner />
      <Workspace initial={plan.doc} mode={{ kind: "local", id, version: plan.version, updatedAt: plan.updatedAt }} isSample={plan.isSample} aiEnabled={aiEnabled} />
    </>
  );
}

export { DemoBanner };
