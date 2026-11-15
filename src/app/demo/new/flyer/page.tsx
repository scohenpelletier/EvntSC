import { DemoBanner } from "@/components/DemoPages";
import { NewPlan } from "@/components/NewPlan";
import { aiConfigured } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function DemoNewFromFlyerPage() {
  // Same rule as /demo/new: AI in the local demo only when no account backend exists.
  return (
    <>
      <DemoBanner />
      <NewPlan storage="local" mode="flyer" aiEnabled={aiConfigured() && !isSupabaseConfigured()} />
    </>
  );
}
