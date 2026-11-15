import type { Metadata } from "next";
import { InfoSection } from "@/components/InfoPage";
import { PageBand } from "@/components/ui";
import { troyLensEnabled } from "@/lib/troylens/card";

export const metadata: Metadata = { title: "Privacy & terms · EvntSC" };

export default function PrivacyPage() {
  const discover = troyLensEnabled();
  return (
    <div>
      <PageBand eyebrow="Privacy" title="Privacy & terms" subtitle="A student prototype. Here’s what it stores and who can see it." />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <InfoSection id="stored" title="What’s stored">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your account email, used to sign in.</li>
            <li>Your plans: event details, budget lines, checklist progress, notes and drafts.</li>
            <li>Settings you choose: default organization, notification preferences{discover ? ", and Discover interests" : ""}.</li>
            <li>Local demo plans are kept only in your browser’s storage, not on the server.</li>
          </ul>
        </InfoSection>
        <InfoSection id="access" title="Who can see it">
          <p>
            Plans are private to your account. Database rules only let your signed-in account read, change, or delete them.
            {discover && " If you publish an event card to Discover, that card’s title, organizer, date, place, description and topics are visible to anyone using Discover until you unpublish it or delete the plan."}
          </p>
        </InfoSection>
        <InfoSection id="ai" title="AI features">
          <p>
            When you use an AI feature (describing an event, reading a flyer, reviewing a plan, updating details, or drafting an email), the text or image you
            submit is sent to the AI provider configured on this server to produce a proposal. Flyer images are not saved to your plan. Nothing an AI
            proposes is applied until you accept it, and every feature also works without AI.
          </p>
        </InfoSection>
        <InfoSection id="email" title="Email">
          <p>
            EvntSC only sends account emails (verification and password reset). Reminder and update preferences are saved, but no reminder or update emails
            are sent yet. Draft emails are text for you to copy; EvntSC never sends them for you.
          </p>
        </InfoSection>
        <InfoSection id="terms" title="Terms of use">
          <p>
            EvntSC is a student hackathon prototype and is not affiliated with or endorsed by the University of Southern California. It provides planning
            help only. It does not approve events, book space, or submit applications, and requirements may change; confirm everything with the USC office
            responsible. Sample plans are fictional.
          </p>
          <p>Deleting a plan removes it permanently. To remove your account, contact the project maintainers.</p>
        </InfoSection>
      </div>
    </div>
  );
}
