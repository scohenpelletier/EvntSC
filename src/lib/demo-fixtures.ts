import { intakeProposalFrom, type IntakeProposal } from "./ai/sanitize";

/**
 * DEMO MODE fixture. Used only when no AI provider is configured, and always
 * labeled "Demo fixture — not live AI" in the UI. It is a hand-written model
 * response for EXAMPLE_PROMPT, passed through the same sanitizer as real AI
 * output, so it can't contain anything the real path would reject.
 */
export const EXAMPLE_PROMPT =
  "We're hosting a networking night for 60 USC students and 5 alumni next month. We have an $800 budget, want food, and haven't booked a room.";

export function demoProposal(): IntakeProposal {
  return intakeProposalFrom(
    {
      title: "Alumni Networking Night",
      eventType: "networking",
      purpose: "Connect students with alumni",
      organizerName: null,
      organization: null,
      dateText: "next month",
      date: null,
      startTime: null,
      endTime: null,
      attendance: 60,
      guestCount: 5,
      venueName: null,
      venueType: "unknown",
      venueStatus: "not_started",
      recognition: "unknown",
      food: "yes",
      outsideSpeakers: "yes",
      vendors: "unknown",
      fundraising: "unknown",
      accessibility: "unknown",
      accessibilityNotes: null,
      budgetTarget: 800,
      expenses: [{ description: "Food for attendees and guests", category: "food", quantity: null, unitCost: null }],
      openQuestions: ["Which date next month, and what time?", "Is your organization a recognized student organization?", "Will the alumni need parking?"],
      assumptions: ["The 5 alumni are unpaid guests (no honorarium or travel costs).", "Food is for all 65 people, students and alumni."],
    },
    EXAMPLE_PROMPT,
  );
}
