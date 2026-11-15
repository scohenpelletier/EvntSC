import { NewPlan } from "@/components/NewPlan";
import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";

export default async function NewPlanPage() {
  const user = await requireUser();
  return <NewPlan storage="remote" aiEnabled={aiConfigured()} defaultOrganization={user.prefs.organization} />;
}
