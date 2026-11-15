import { DemoPlan } from "@/components/DemoPages";
import { aiConfigured } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function DemoPlanPage({ params }: PageProps<"/demo/[id]">) {
  const { id } = await params;
  return <DemoPlan id={id} aiEnabled={aiConfigured() && !isSupabaseConfigured()} />;
}
