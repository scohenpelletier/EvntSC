import type { Metadata } from "next";
import { PageBand } from "@/components/ui";
import { WelcomeForm } from "@/components/WelcomeForm";
import { requireUser } from "@/lib/supabase/server";
import { troyLensEnabled } from "@/lib/troylens/card";

export const metadata: Metadata = { title: "Welcome · EvntSC" };

export default async function WelcomePage() {
  const user = await requireUser();
  return (
    <div>
      <PageBand eyebrow="Welcome to EvntSC" title="Let’s set you up." subtitle="Two quick, optional questions. You can change both later in Settings." />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <WelcomeForm initialInterests={user.interests} initialOrg={user.prefs.organization} discover={troyLensEnabled()} />
      </div>
    </div>
  );
}
