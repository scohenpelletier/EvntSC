import { DemoBanner } from "@/components/DemoPages";
import { NewPlan } from "@/components/NewPlan";
import { aiConfigured } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function DemoNewPage() {
  // AI in the local demo is only offered when no account backend exists (local development).
  return (
    <>
      <DemoBanner />
      <NewPlan storage="local" aiEnabled={aiConfigured() && !isSupabaseConfigured()} />
    </>
  );
}
