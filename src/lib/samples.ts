import { emptyIntake, type PlanDoc, type TaskState } from "./schema";

/**
 * FICTIONAL sample plans. Organizations, people, and figures are invented.
 * Event dates are fixed in spring 2027 so the samples stay in the future
 * relative to the documented demo reference date (2026-11-12).
 */
export const DEMO_REFERENCE_DATE = "2026-11-12";

const T = "2026-11-12T00:00:00.000Z";
const done = (id: string, label: string, snap: Record<string, string>, notes = ""): TaskState => ({
  id,
  label,
  status: "done",
  doneSnapshot: snap,
  notes,
  targetDate: null,
  custom: null,
  updatedAt: T,
});

export type SamplePlan = { key: string; summary: string; doc: PlanDoc };

export const SAMPLES: SamplePlan[] = [
  {
    key: "resume-workshop",
    summary: "Largely complete: confirmed room, known costs under target.",
    doc: {
      intake: {
        ...emptyIntake(),
        title: "[Sample] Resume Review Workshop",
        description: "Hands-on resume workshop with peer reviewers. Fictional sample plan.",
        eventType: "workshop",
        organizerName: "Jordan Lee (fictional)",
        organization: "Trojan Pre-Professional Society (fictional)",
        date: "2027-02-24",
        startTime: "18:00",
        endTime: "19:30",
        attendance: 40,
        venueName: "Taper Hall 101 (example)",
        venueType: "classroom",
        venueStatus: "confirmed",
        recognition: "recognized",
        food: "no",
        outsideSpeakers: "no",
        highProfileGuest: "no",
        vendors: "no",
        vendorStatus: "none_needed",
        fundraising: "no",
        budgetTarget: "150",
        notes: "Peer reviewers recruited from last semester's cohort.",
      },
      budget: [
        { id: "l1", description: "Printed resume templates", category: "supplies", quantity: "40", unitCost: "0.25", costUnknown: false, costType: "estimate", notes: "" },
        { id: "l2", description: "Flyers", category: "marketing", quantity: "30", unitCost: "0.50", costUnknown: false, costType: "estimate", notes: "" },
        { id: "l3", description: "Name tags", category: "supplies", quantity: "1", unitCost: "12.99", costUnknown: false, costType: "estimate", notes: "One pack" },
      ],
      tasks: [done("sugg:promote", "Start promoting the event", { date: "2027-02-24" }, "Posted to Instagram and the newsletter.")],
      questions: [],
      aiNotes: [],
      assumptions: [],
      drafts: [],
      changeLog: [],
    },
  },
  {
    key: "founder-night",
    summary: "Known costs exceed the target; venue cost still unknown.",
    doc: {
      intake: {
        ...emptyIntake(),
        title: "[Sample] Founder Speaker Night",
        description: "Info session with a local startup founder, pizza afterward. Fictional sample plan.",
        eventType: "info_session",
        organizerName: "Sam Rivera (fictional)",
        organization: "Trojan Startup Circle (fictional)",
        date: "2027-03-10",
        startTime: "19:00",
        endTime: "20:30",
        attendance: 60,
        venueName: "Event space TBD",
        venueType: "event_space",
        venueStatus: "not_started",
        recognition: "recognized",
        food: "yes",
        outsideSpeakers: "yes",
        highProfileGuest: "no",
        vendors: "no",
        vendorStatus: "none_needed",
        fundraising: "no",
        budgetTarget: "600",
        fundingRequested: "400",
        fundingConfirmed: "",
      },
      budget: [
        { id: "l1", description: "Pizza (large)", category: "food", quantity: "6", unitCost: "45", costUnknown: false, costType: "estimate", notes: "Caterer not chosen yet" },
        { id: "l2", description: "Speaker honorarium", category: "speaker", quantity: "1", unitCost: "300", costUnknown: false, costType: "estimate", notes: "" },
        { id: "l3", description: "Promotional posters", category: "marketing", quantity: "4", unitCost: "15", costUnknown: false, costType: "estimate", notes: "" },
        { id: "l4", description: "Event space fee", category: "venue", quantity: "1", unitCost: "", costUnknown: true, costType: "estimate", notes: "Ask TES whether there is a fee" },
      ],
      tasks: [],
      questions: [{ id: "q1", text: "Does the speaker need a parking pass?", resolved: false, answer: "" }],
      aiNotes: [],
      assumptions: [],
      drafts: [],
      changeLog: [],
    },
  },
  {
    key: "python-info",
    summary: "Ambiguous date and open decisions; a completed task needs rechecking after a date edit.",
    doc: {
      intake: {
        ...emptyIntake(),
        title: "[Sample] Intro to Python Info Session",
        description: "Info session for a spring Python study group, sometime mid-February. Fictional sample plan.",
        eventType: "info_session",
        organizerName: "Avery Chen (fictional)",
        organization: "Code Trojans (fictional)",
        date: "2027-02-17",
        dateConfirmed: false,
        startTime: "17:00",
        endTime: null,
        attendance: null,
        venueName: "",
        venueType: "unknown",
        venueStatus: "requested",
        recognition: "unknown",
        food: "unknown",
        outsideSpeakers: "no",
        highProfileGuest: "no",
        vendors: "unknown",
        fundraising: "unknown",
        budgetTarget: "100",
      },
      budget: [
        { id: "l1", description: "Snacks", category: "food", quantity: "1", unitCost: "", costUnknown: true, costType: "estimate", notes: "If we serve food" },
        { id: "l2", description: "Stickers", category: "marketing", quantity: "100", unitCost: "0.35", costUnknown: false, costType: "estimate", notes: "" },
      ],
      tasks: [
        done("sugg:promote", "Start promoting the event", { date: "2027-02-17" }, "Draft post written for Feb 3."),
        done(
          "rule:rso-space-request",
          "Follow up on your Trojan Event Services space request",
          { venueStatus: "requested", venueType: "unknown", venueName: "", date: "2027-02-17", startTime: "17:00", endTime: "", recognition: "unknown" },
          "Submitted request #12345 (fictional).",
        ),
      ],
      questions: [
        { id: "q1", text: "Is the 17th or the 24th better for the study group lead?", resolved: false, answer: "" },
        { id: "q2", text: "Do we need laptops for attendees?", resolved: false, answer: "" },
      ],
      aiNotes: [],
      assumptions: [],
      drafts: [],
      changeLog: [],
    },
  },
];
