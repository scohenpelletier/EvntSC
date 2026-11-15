import type { Metadata } from "next";
import { NewPlan } from "@/components/NewPlan";
import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Start from a flyer · EvntSC" };

export default async function NewPlanFromFlyerPage() {
  const user = await requireUser();
  return <NewPlan storage="remote" mode="flyer" aiEnabled={aiConfigured()} defaultOrganization={user.prefs.organization} />;
}
