"use client";
import type { Intake } from "@/lib/schema";
import { Button } from "./ui";

type Q = { key: string; question: string; why: string; options: { label: string; patch: Partial<Intake> }[] };

/**
 * Up to three quick questions, chosen only from unknowns that materially change
 * the plan (which office handles space, whether catering rules apply, guest
 * tasks). Every question can be skipped; skipped details stay "unknown".
 */
export function followUpQuestions(i: Intake, skipped: string[] = []): Q[] {
  const qs: Q[] = [];
  if (i.venueType === "unknown" && i.venueStatus !== "confirmed")
    qs.push({
      key: "venueType",
      question: "What kind of space do you want?",
      why: "Classrooms and event spaces are booked through different offices.",
      options: [
        { label: "Classroom", patch: { venueType: "classroom" } },
        { label: "Event space", patch: { venueType: "event_space" } },
        { label: "Outdoors", patch: { venueType: "outdoor" } },
      ],
    });
  if (i.food === "unknown")
    qs.push({ key: "food", question: "Will you serve food?", why: "Food brings in USC's catering rules and is usually the biggest cost.", options: [{ label: "Yes", patch: { food: "yes" } }, { label: "No", patch: { food: "no" } }] });
  if (i.outsideSpeakers === "unknown")
    qs.push({
      key: "guests",
      question: "Are outside guests (alumni, speakers, employers) coming?",
      why: "Guests add invitations and arrival logistics.",
      options: [
        { label: "Yes", patch: { outsideSpeakers: "yes" } },
        { label: "No", patch: { outsideSpeakers: "no", guestCount: null } },
      ],
    });
  if (i.recognition === "unknown")
    qs.push({
      key: "recognition",
      question: "Is your club a recognized student organization (RSO)?",
      why: "The cited space-booking and USG funding rules are written for RSOs.",
      options: [
        { label: "Yes", patch: { recognition: "recognized" } },
        { label: "No", patch: { recognition: "not_recognized" } },
      ],
    });
  return qs.filter((q) => !skipped.includes(q.key)).slice(0, 3);
}

export function FollowUps({ intake, skipped, onAnswer, onSkip }: { intake: Intake; skipped: string[]; onAnswer: (patch: Partial<Intake>) => void; onSkip: (key: string) => void }) {
  const qs = followUpQuestions(intake, skipped);
  if (!qs.length) return null;
  return (
    <div className="space-y-3">
      {qs.map((q) => (
        <fieldset key={q.key} className="rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-semibold">{q.question}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {q.options.map((o) => (
              <Button key={o.label} size="sm" onClick={() => onAnswer(o.patch)}>
                {o.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => onSkip(q.key)}>
              Not sure yet
            </Button>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
