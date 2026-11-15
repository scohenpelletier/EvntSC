"use client";
import { useRouter } from "next/navigation";
import { PlanList, type PlanListItem } from "./PlanList";

async function call(url: string, method: string) {
  const res = await fetch(url, { method });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
}

export function RemotePlanList({ plans }: { plans: PlanListItem[] }) {
  const router = useRouter();
  return (
    <PlanList
      plans={plans}
      newHref="/plans/new"
      onDelete={async (id) => {
        await call(`/api/plans/${id}`, "DELETE");
        router.refresh();
      }}
      onLoadSamples={async () => {
        await call("/api/samples", "POST");
        router.refresh();
      }}
      onResetSamples={async () => {
        await call("/api/samples", "DELETE");
        router.refresh();
      }}
    />
  );
}
