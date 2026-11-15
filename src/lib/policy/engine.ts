import type { BudgetSummary } from "../budget";
import { addCalendarDays } from "../dates";
import { formatCents } from "../money";
import type { Intake } from "../schema";
import { RULES, SUGGESTION_OFFSETS, type Link } from "./registry";

/**
 * Deterministic evaluation of the intake against the registry. Applicability
 * is tri-state: an unknown condition produces a question, never a pass.
 */

export type TaskType = "requirement" | "suggestion" | "question";
export type BaseStatus = "todo" | "needs_confirmation" | "missing_info";

export type TargetKind = "official_computed" | "suggested_offset";
export type DerivedTarget = { date: string; kind: TargetKind; explanation: string };

export type Area = "details" | "venue" | "guests" | "catering" | "budget" | "promotion" | "accessibility" | "operations" | "followup";
export const AREAS: { id: Area; title: string }[] = [
  { id: "details", title: "Event details to settle" },
  { id: "venue", title: "Venue and campus coordination" },
  { id: "guests", title: "Speakers and guests" },
  { id: "catering", title: "Catering and supplies" },
  { id: "budget", title: "Budget and funding" },
  { id: "promotion", title: "Promotion and registration" },
  { id: "accessibility", title: "Accessibility" },
  { id: "operations", title: "Event-day operations" },
  { id: "followup", title: "Follow-up" },
];

/**
 * - requirement: a registered rule whose verified source applies to this event.
 * - recommendation: an EvntSC planning suggestion (never a USC rule).
 * - needs_confirmation: may apply or is undocumented; ask the office.
 */
export type Designation = "requirement" | "recommendation" | "needs_confirmation";

export type DerivedTask = Omit<RawTask, "mayApply"> & {
  area: Area;
  designation: Designation;
  /** IDs from lib/resources: the offices or services relevant to this task. */
  resourceIds: string[];
  /** Set when the usual lead time has already passed: says so and gives a practical next step. */
  lateNote: string | null;
};

type RawTask = {
  /** True when the rule's condition depends on an unknown detail (it may not apply). */
  mayApply?: boolean;
  id: string;
  type: TaskType;
  title: string;
  detail: string;
  conditionText: string;
  baseStatus: BaseStatus;
  ruleId: string | null;
  target: DerivedTarget | null;
  /** Shown when timing exists but cannot be computed safely. */
  deadlineNote: string | null;
  dependsOn: string | null;
  links: Link[];
  /** Intake-derived values this task depends on (for recheck detection). */
  depValues: Record<string, string>;
};

export const DEP_LABELS: Record<string, string> = {
  date: "Event date",
  startTime: "Start time",
  endTime: "End time",
  attendance: "Expected attendance",
  venueStatus: "Venue status",
  venueType: "Venue type",
  venueName: "Venue",
  recognition: "Recognition status",
  food: "Food",
  outsideSpeakers: "Outside speakers",
  highProfileGuest: "High-profile guest",
  vendors: "Vendors",
  vendorStatus: "Vendor status",
  fundraising: "Fundraising",
  fundingRequested: "Funding requested",
  budgetTarget: "Budget target",
  eventType: "Event type",
  guestCount: "Outside guests",
  accessibility: "Accessibility needs",
  accessibilityNotes: "Accessibility notes",
  "budget.unknownCount": "Number of unknown costs",
};

function deps(intake: Intake, keys: (keyof Intake)[], extra: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = intake[k] === null || intake[k] === undefined ? "" : String(intake[k]);
  return { ...out, ...extra };
}

export type Evaluation = {
  tasks: DerivedTask[];
  scopeWarning: string | null;
  /** Event-level timing problem (date already passed), if any. */
  timingWarning: string | null;
  seekingFunding: boolean;
};

const AREA_BY_ID: Record<string, Area> = {
  "q:scope": "details",
  "q:date": "details",
  "q:date-confirm": "details",
  "q:time": "details",
  "q:attendance": "details",
  "q:venue": "venue",
  "rule:rso-space-request": "venue",
  "rule:rso-classroom-week4": "venue",
  "rule:rso-handbook-social": "venue",
  "q:vendor-rules": "venue",
  "sugg:capacity": "venue",
  "sugg:weather-backup": "venue",
  "rule:usg-applicant-eligibility": "budget",
  "rule:usg-application-deadline": "budget",
  "rule:usg-event-cap": "budget",
  "rule:usg-guidelines-unverified": "budget",
  "rule:rso-fundraising-uepa": "budget",
  "q:fundraising": "budget",
  "sugg:quotes": "budget",
  "sugg:budget-gap": "budget",
  "rule:tes-catering": "catering",
  "q:food": "catering",
  "sugg:catering-quote": "catering",
  "sugg:food-headcount": "catering",
  "rule:tes-high-profile-guest": "guests",
  "q:high-profile": "guests",
  "q:speaker-rules": "guests",
  "q:speakers": "guests",
  "sugg:guest-invite": "guests",
  "sugg:speaker-logistics": "guests",
  "sugg:promote": "promotion",
  "sugg:registration": "promotion",
  "q:accessibility": "accessibility",
  "sugg:access-info": "accessibility",
  "sugg:access-confirm": "accessibility",
  "sugg:room-check": "operations",
  "sugg:day-of-roles": "operations",
  "sugg:follow-up": "followup",
};

const CATERERS = ["usc-hospitality-catering", "university-club", "hospitality-approvals"];
const RESOURCES_BY_ID: Record<string, string[]> = {
  "rule:rso-space-request": ["tes", "campus-activities"],
  "rule:rso-classroom-week4": ["campus-activities"],
  "rule:rso-handbook-social": ["campus-activities"],
  "q:venue": ["tes"],
  "sugg:capacity": ["tes"],
  "sugg:weather-backup": ["tes"],
  "q:vendor-rules": ["tes"],
  "rule:usg-applicant-eligibility": ["usg-funding"],
  "rule:usg-application-deadline": ["usg-funding"],
  "rule:usg-event-cap": ["usg-funding"],
  "rule:usg-guidelines-unverified": ["usg-funding"],
  "rule:rso-fundraising-uepa": ["campus-activities"],
  "rule:tes-catering": CATERERS,
  "sugg:catering-quote": CATERERS,
  "sugg:food-headcount": ["usc-hospitality-catering"],
  "rule:tes-high-profile-guest": ["tes"],
  "q:speaker-rules": ["campus-activities"],
  "sugg:access-info": ["osas"],
  "sugg:access-confirm": ["osas", "tes"],
};

const LATE_STEP: Record<string, string> = {
  "sugg:promote": "post today and ask partner clubs to share.",
  "sugg:registration": "open a simple RSVP form today so you have a headcount.",
  "sugg:guest-invite": "message guests directly today and ask for a quick yes or no.",
  "sugg:catering-quote": "call the caterer's sales office instead of emailing.",
  "sugg:access-info": "add an accommodations line to your next announcement.",
  "sugg:weather-backup": "ask TES today whether an indoor space is still available.",
};

/** Calendar days from `today` to `date` (both YYYY-MM-DD). */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000);
}

function finalize(raw: RawTask, intake: Intake, today: string | null): DerivedTask {
  const { mayApply, ...t } = raw;
  const designation: Designation =
    t.type === "suggestion" ? "recommendation" : t.type === "question" || mayApply ? "needs_confirmation" : "requirement";
  let lateNote: string | null = null;
  const until = today && intake.date ? daysBetween(today, intake.date) : null;
  if (until !== null && until >= 0 && t.target && t.target.date < today!) {
    lateNote = `The suggested date has passed and the event is ${until === 0 ? "today" : `${until} day${until === 1 ? "" : "s"} away`}. Do this as soon as you can${LATE_STEP[t.id] ? `: ${LATE_STEP[t.id]}` : "."}`;
  }
  if (t.id === "rule:usg-application-deadline" && until !== null && until >= 0 && until < 42) {
    lateNote = `Your event is ${until} day${until === 1 ? "" : "s"} away. Six academic weeks is at least 42 calendar days, so a USG application is very likely too late for this date. Next step: email USG to ask, and plan a budget that doesn't depend on USG funding.`;
  }
  if (t.id === "sugg:catering-quote" && until !== null && until >= 0 && until <= 4) {
    lateNote = `Your event is ${until} day${until === 1 ? "" : "s"} away. Catering2Go's page says orders need at least 48 business hours, so call the sales office today.`;
  }
  return { ...t, area: AREA_BY_ID[t.id] ?? "details", designation, resourceIds: RESOURCES_BY_ID[t.id] ?? [], lateNote };
}

export function evaluate(intake: Intake, budget: BudgetSummary, today: string | null = null): Evaluation {
  const raw: RawTask[] = [];
  const push = (t: RawTask) => raw.push(t);
  /** An EvntSC recommendation without a date. */
  const rec = (id: string, title: string, detail: string, depValues: Record<string, string>, cond: string, dependsOn: string | null = null): RawTask => ({
    id,
    type: "suggestion",
    title,
    detail,
    conditionText: cond,
    baseStatus: "todo",
    ruleId: null,
    target: null,
    deadlineNote: null,
    dependsOn,
    links: [],
    depValues,
  });
  /** An EvntSC recommendation with a suggested lead time relative to the event date. */
  const pushDated = (id: string, title: string, detail: string, offset: number, dv: Record<string, string>, cond: string, dependsOn: string | null = null) => {
    const when = `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"} the event`;
    push({
      ...rec(id, title, detail, dv, cond, dependsOn),
      target: intake.date
        ? { date: addCalendarDays(intake.date, offset), kind: "suggested_offset", explanation: `EvntSC suggestion: ${when}. Not a USC deadline.` }
        : null,
      deadlineNote: intake.date ? null : `Suggested lead time: ${when}. Set the event date to see the day.`,
    });
  };
  const rule = (id: string) => RULES[id];
  const seekingFunding = (budget.requested.cents ?? 0) > 0;

  const scopeWarning =
    intake.eventType === "other"
      ? "EvntSC supports on-campus networking events, workshops, and information sessions. For other event types, the requirements below may be incomplete or not apply — confirm everything with Campus Activities."
      : null;

  if (scopeWarning) {
    push({
      id: "q:scope",
      type: "question",
      title: "Confirm requirements for an unsupported event type",
      detail: scopeWarning,
      conditionText: "Event type is “Other”.",
      baseStatus: "needs_confirmation",
      ruleId: null,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: [{ label: "Campus Activities RSO Resources", url: "https://campusactivities.usc.edu/programs/recognized-student-organizations/rso-resources/" }],
      depValues: deps(intake, ["eventType"]),
    });
  }

  // ---- Missing information questions -------------------------------------
  if (!intake.date) {
    push(question("q:date", "Choose the event date", "Date-based tasks and reminders can't be scheduled without a date.", deps(intake, ["date"])));
  } else if (!intake.dateConfirmed) {
    push({
      ...question("q:date-confirm", "Confirm the event date", "The date came from your description and may be missing a year or be ambiguous. Confirm it in the intake.", deps(intake, ["date", "dateConfirmed" as keyof Intake])),
      baseStatus: "needs_confirmation",
    });
  }
  if (!intake.startTime || !intake.endTime) {
    push(question("q:time", "Set start and end times", "Times are needed for room requests and catering.", deps(intake, ["startTime", "endTime"])));
  }
  if (intake.attendance === null) {
    push(question("q:attendance", "Estimate expected attendance", "Attendance drives room size, food quantity, and budget lines.", deps(intake, ["attendance"])));
  }
  if (intake.venueStatus === "unknown") {
    push(question("q:venue", "Record where the venue stands", "Mark whether space has been requested or confirmed.", deps(intake, ["venueStatus"])));
  }

  // ---- Space ---------------------------------------------------------------
  if (intake.venueStatus !== "confirmed") {
    const t = intake.venueType;
    if (t === "event_space" || t === "outdoor" || t === "unknown") {
      const r = rule("rso-space-request");
      const requested = intake.venueStatus === "requested";
      push({
        id: "rule:rso-space-request",
        type: "requirement",
        title: requested ? "Follow up on your Trojan Event Services space request" : r.title,
        detail:
          intake.recognition === "recognized"
            ? "Submit (or follow up on) an online reservation request. Booking depends on availability."
            : "The cited passage covers Recognized Student Organizations in good standing. Your recognition status is " +
              (intake.recognition === "unknown" ? "unknown" : "“not recognized”") +
              " — confirm with Campus Activities how you can book space.",
        conditionText: t === "unknown" ? "Venue type is unknown, so this may apply. " + r.conditionText : r.conditionText,
        // The cited passage covers recognized RSOs; for anyone else it may not apply as written.
        mayApply: t === "unknown" || intake.recognition !== "recognized",
        baseStatus: intake.recognition === "recognized" && t !== "unknown" ? "todo" : "needs_confirmation",
        ruleId: r.id,
        target: null,
        deadlineNote: "The cited source states no lead time for event-space requests.",
        dependsOn: null,
        links: r.links,
        depValues: deps(intake, ["venueStatus", "venueType", "venueName", "date", "startTime", "endTime", "recognition"]),
      });
    }
    if (t === "classroom" || t === "unknown") {
      const r = rule("rso-classroom-week4");
      push({
        id: "rule:rso-classroom-week4",
        type: "requirement",
        title: r.title,
        detail: "Submit the classroom request form once requests open. EvntSC does not convert “Week 4” to a calendar date — check the academic calendar.",
        conditionText: t === "unknown" ? "Venue type is unknown, so this may apply. " + r.conditionText : r.conditionText,
        mayApply: t === "unknown",
        baseStatus: "needs_confirmation",
        ruleId: r.id,
        target: null,
        deadlineNote: "Timing is “starting Week 4” of the term. Needs confirmation against the academic calendar.",
        dependsOn: null,
        links: r.links,
        depValues: deps(intake, ["venueStatus", "venueType", "venueName", "date", "startTime", "endTime"]),
      });
    }
  }

  // ---- Funding -------------------------------------------------------------
  if (seekingFunding) {
    const elig = rule("usg-applicant-eligibility");
    push({
      id: "rule:usg-applicant-eligibility",
      type: "requirement",
      title: elig.title,
      detail:
        intake.recognition === "recognized"
          ? "You reported a recognized organization. EvntSC cannot verify recognition or eligibility — USG decides."
          : intake.recognition === "unknown"
            ? "Your recognition status is unknown. Confirm it before applying; EvntSC cannot verify eligibility."
            : "You reported the organization is not recognized. The form also lists USC undergraduate students — confirm with usgfunds@usc.edu which applies to you.",
      conditionText: elig.conditionText,
      baseStatus: intake.recognition === "recognized" ? "todo" : "needs_confirmation",
      ruleId: elig.id,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: elig.links,
      depValues: deps(intake, ["recognition", "fundingRequested"]),
    });

    const dl = rule("usg-application-deadline");
    push({
      id: "rule:usg-application-deadline",
      type: "requirement",
      title: "Submit the USG funding application on time",
      detail: "The deadline is counted in academic weeks. EvntSC does not convert academic weeks into calendar weeks or guess how breaks are treated. Confirm the exact Wednesday with USG.",
      conditionText: dl.conditionText,
      baseStatus: "needs_confirmation",
      ruleId: dl.id,
      target: null,
      deadlineNote: `Official timing: ${dl.deadline?.wording}. Needs confirmation.`,
      dependsOn: "rule:usg-applicant-eligibility",
      links: dl.links,
      depValues: deps(intake, ["date", "vendors", "vendorStatus", "fundingRequested"]),
    });

    const cap = rule("usg-event-cap");
    const over = (budget.requested.cents ?? 0) > 800_000;
    push({
      id: "rule:usg-event-cap",
      type: "requirement",
      title: over ? "Your request is above the stated $8,000 yearly limit" : "Check your organization's funded-event count and yearly total",
      detail: over
        ? `You entered ${formatCents(budget.requested.cents!)} requested; the cited passage limits each RSO to under $8,000 per year.`
        : "EvntSC doesn't know how many events your RSO already had funded this semester or its yearly total. Requested funding is never treated as awarded.",
      conditionText: cap.conditionText,
      baseStatus: "needs_confirmation",
      ruleId: cap.id,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: cap.links,
      depValues: deps(intake, ["fundingRequested"]),
    });

    const g = rule("usg-guidelines-unverified");
    push({
      id: "rule:usg-guidelines-unverified",
      type: "question",
      title: g.title,
      detail: "The linked guidelines document required sign-in and could not be read when the registry was reviewed. Food, speaker, and eligibility details there are not reflected in EvntSC.",
      conditionText: g.conditionText,
      baseStatus: "needs_confirmation",
      ruleId: g.id,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: g.links,
      depValues: deps(intake, ["fundingRequested"]),
    });
  }

  // ---- Fundraising ----------------------------------------------------------
  if (intake.fundraising === "yes") {
    const r = rule("rso-fundraising-uepa");
    const days = r.deadline?.type === "calendar_days_before" ? r.deadline.days : 14;
    push({
      id: "rule:rso-fundraising-uepa",
      type: "requirement",
      title: r.title,
      detail: "Submit a UEPA and schedule the Campus Activities fundraising meeting.",
      conditionText: r.conditionText,
      baseStatus: intake.date ? "todo" : "needs_confirmation",
      ruleId: r.id,
      target: intake.date
        ? {
            date: addCalendarDays(intake.date, -days),
            kind: "official_computed",
            explanation: "Latest meeting date from “at least two weeks prior” (14 calendar days; the passage does not say academic weeks).",
          }
        : null,
      deadlineNote: intake.date ? null : "Set the event date to calculate the two-week meeting date.",
      dependsOn: null,
      links: r.links,
      depValues: deps(intake, ["fundraising", "date"]),
    });
  } else if (intake.fundraising === "unknown") {
    push(question("q:fundraising", "Decide whether the event involves fundraising", "Fundraising (sales, tickets, donations) triggers a cited UEPA requirement with a two-week lead time.", deps(intake, ["fundraising"])));
  }

  // ---- Food ----------------------------------------------------------------
  if (intake.food === "yes") {
    const r = rule("tes-catering");
    push({
      id: "rule:tes-catering",
      type: "requirement",
      title: r.title,
      detail: "TES names USC Hospitality and the University Club as the only on-campus caterers. Use one of them, or confirm your venue allows an outside caterer before ordering.",
      conditionText: r.conditionText,
      baseStatus: intake.venueStatus === "confirmed" ? "todo" : "needs_confirmation",
      ruleId: r.id,
      target: null,
      deadlineNote: "The cited source states no lead time.",
      dependsOn: null,
      links: r.links,
      depValues: deps(intake, ["food", "venueName", "venueStatus"]),
    });
  } else if (intake.food === "unknown") {
    push(question("q:food", "Decide whether food will be served", "Serving food triggers a cited catering requirement and affects your budget.", deps(intake, ["food"])));
  }

  // ---- Speakers -------------------------------------------------------------
  if (intake.outsideSpeakers === "yes") {
    if (intake.highProfileGuest === "yes") {
      const r = rule("tes-high-profile-guest");
      push({
        id: "rule:tes-high-profile-guest",
        type: "requirement",
        title: r.title,
        detail: "Contact Trojan Event Services about the required approval before announcing the guest.",
        conditionText: r.conditionText,
        baseStatus: "needs_confirmation",
        ruleId: r.id,
        target: null,
        deadlineNote: "The cited source states no lead time.",
        dependsOn: null,
        links: r.links,
        depValues: deps(intake, ["outsideSpeakers", "highProfileGuest"]),
      });
    } else if (intake.highProfileGuest === "unknown") {
      push(question("q:high-profile", "Is any guest a celebrity, political leader, or dignitary?", "If so, a cited TES approval applies.", deps(intake, ["outsideSpeakers", "highProfileGuest"])));
    }
    push({
      ...question("q:speaker-rules", "Confirm outside-speaker requirements", "EvntSC found no verified general rule for outside speakers at RSO events. Ask Campus Activities whether a speaker form or contract is needed.", deps(intake, ["outsideSpeakers"])),
      baseStatus: "needs_confirmation",
      links: [{ label: "Campus Activities RSO Resources", url: "https://campusactivities.usc.edu/programs/recognized-student-organizations/rso-resources/" }],
    });
  } else if (intake.outsideSpeakers === "unknown") {
    push(question("q:speakers", "Decide whether outside speakers or guests are involved", "Outside guests can trigger additional approvals and change invitations, food, and parking.", deps(intake, ["outsideSpeakers"])));
  }

  // ---- Vendors --------------------------------------------------------------
  if (intake.vendors === "yes" || intake.vendors === "unknown") {
    push({
      ...question(
        "q:vendor-rules",
        intake.vendors === "yes" ? "Confirm vendor/contract requirements" : "Decide whether you need a vendor",
        intake.vendors === "yes"
          ? "EvntSC found no verified vendor-contract rule for RSO events. Do not sign anything until Trojan Event Services or Campus Activities confirms the process."
          : "Vendors (A/V, rentals, photographers) may involve contracts. Record whether you need one.",
        deps(intake, ["vendors", "vendorStatus"]),
      ),
      baseStatus: intake.vendors === "yes" ? "needs_confirmation" : "missing_info",
      links: [{ label: "TES departmental approvals", url: "https://trojanevents.usc.edu/departmental-event-approvals/" }],
    });
  }

  // ---- Handbook -------------------------------------------------------------
  {
    const r = rule("rso-handbook-social");
    push({
      id: "rule:rso-handbook-social",
      type: "question",
      title: r.title,
      detail: `Confirm whether your ${intake.eventType === "networking" ? "networking event" : "event"} counts as a social event under the Student Handbook.`,
      conditionText: r.conditionText,
      baseStatus: "needs_confirmation",
      ruleId: r.id,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: r.links,
      depValues: deps(intake, ["eventType", "food"]),
    });
  }

  // ---- Planner tasks (EvntSC recommendations, not USC rules) ----------------
  const people = (intake.attendance ?? 0) + (intake.guestCount ?? 0);
  const headcountMatters = intake.eventType === "networking" || intake.food === "yes" || intake.outsideSpeakers === "yes";
  if (intake.attendance !== null && intake.venueStatus !== "confirmed") {
    push(
      rec(
        "sugg:capacity",
        `Ask for a room that fits about ${people} people`,
        `${intake.attendance} attendees${intake.guestCount ? ` plus ${intake.guestCount} guests` : ""}.${intake.eventType === "networking" ? " For networking, ask for open floor space or round tables rather than lecture seating." : ""}`,
        deps(intake, ["attendance", "guestCount", "eventType"]),
        "Attendance is known and the venue isn't confirmed.",
        intake.venueType !== "classroom" ? "rule:rso-space-request" : null,
      ),
    );
  }
  if (intake.venueType === "outdoor") {
    pushDated("sugg:weather-backup", "Arrange an indoor backup for bad weather", "Ask TES whether a rain location can be held alongside the outdoor booking.", -14, deps(intake, ["venueType", "date"]), "Venue is outdoors.");
  }
  if (intake.outsideSpeakers === "yes") {
    pushDated(
      "sugg:guest-invite",
      intake.guestCount ? `Invite ${intake.guestCount} outside guests and ask for RSVPs` : "Invite outside guests and ask for RSVPs",
      "Send the date, time, format, and what you're asking of them. You can draft the invitation from the Contacts tab.",
      -28,
      deps(intake, ["outsideSpeakers", "guestCount", "date"]),
      "Outside speakers or guests are involved.",
    );
  }
  if (intake.food === "yes") {
    pushDated(
      "sugg:catering-quote",
      `Request a catering quote${people ? ` for about ${people} people` : ""}`,
      "Ask for a written quote with per-person pricing and delivery fees, then enter it on the Budget tab as a quote.",
      -21,
      deps(intake, ["food", "attendance", "guestCount", "date"]),
      "Food will be served.",
      "rule:tes-catering",
    );
  }
  if (headcountMatters) {
    pushDated("sugg:registration", "Open an RSVP form", "A headcount sizes the room and the food order. Ask about dietary and accessibility needs on the form.", -21, deps(intake, ["date"]), "Headcount affects the room, food, or guests.");
  }
  if (intake.accessibility === "yes") {
    push({
      ...rec(
        "sugg:access-confirm",
        "Confirm accommodations with the venue",
        `You noted accessibility needs${intake.accessibilityNotes.trim() ? `: ${intake.accessibilityNotes.trim().slice(0, 200)}` : ""}. Confirm step-free access, seating, and anything else needed with the venue. OSAS publishes guidance on planning accessible events.`,
        deps(intake, ["accessibility", "accessibilityNotes", "venueName"]),
        "Accessibility needs were noted.",
      ),
      type: "question",
      baseStatus: "needs_confirmation",
    });
  } else if (intake.accessibility === "unknown") {
    pushDated("sugg:access-info", "Invite attendees to request accommodations", "Add a line to your RSVP form or announcement with a contact for accessibility requests, so needs come in before the event.", -21, deps(intake, ["accessibility", "date"]), "Accessibility needs aren't known yet.");
  }
  if (intake.eventType === "networking" || (intake.attendance ?? 0) >= 30) {
    pushDated(
      "sugg:day-of-roles",
      "Assign day-of roles",
      intake.eventType === "networking" ? "Check-in and name tags, a greeter for guests, someone to introduce students to alumni, and cleanup." : "Check-in, A/V, timekeeping, and cleanup.",
      -3,
      deps(intake, ["date", "eventType"]),
      "The event has enough people to need helpers.",
    );
  }
  if (budget.overTargetCents !== null) {
    push(rec("sugg:budget-gap", `Close the ${formatCents(budget.overTargetCents)} gap to your budget`, "The Budget tab lists options and the assumptions behind each one.", { budgetTarget: intake.budgetTarget }, "Known costs are over your budget target."));
  }

  // ---- Budget follow-ups ----------------------------------------------------
  if (budget.unknownCount > 0) {
    push({
      id: "sugg:quotes",
      type: "suggestion",
      title: `Get figures for ${budget.unknownCount} unknown cost${budget.unknownCount === 1 ? "" : "s"}`,
      detail: "Ask the venue or vendor for a written figure, then enter it on the Budget tab.",
      conditionText: "Some expense lines are marked “cost unknown”.",
      baseStatus: "missing_info",
      ruleId: null,
      target: null,
      deadlineNote: null,
      dependsOn: null,
      links: [],
      depValues: { "budget.unknownCount": String(budget.unknownCount) },
    });
  }

  // ---- Suggested reminders (EvntSC defaults, not USC deadlines) --------
  if (intake.date) {
    const s = (id: string, title: string, detail: string, offset: number, dv: Record<string, string>, cond: string, dependsOn: string | null = null) =>
      push({
        id,
        type: "suggestion",
        title,
        detail,
        conditionText: cond,
        baseStatus: "todo",
        ruleId: null,
        target: {
          date: addCalendarDays(intake.date!, offset),
          kind: "suggested_offset",
          explanation: `EvntSC suggestion: ${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"} the event. Not a USC deadline.`,
        },
        deadlineNote: null,
        dependsOn,
        links: [],
        depValues: dv,
      });
    s("sugg:promote", "Start promoting the event", "Post on your channels and share a sign-up link.", SUGGESTION_OFFSETS.promote, deps(intake, ["date"]), "Event date is set.");
    if (intake.food === "yes")
      s("sugg:food-headcount", "Confirm final headcount for food", "Send your caterer an updated count.", SUGGESTION_OFFSETS.foodHeadcount, deps(intake, ["date", "attendance", "food"]), "Food will be served.", "rule:tes-catering");
    if (intake.outsideSpeakers === "yes")
      s("sugg:speaker-logistics", "Confirm guest arrival details and parking", "Send speakers and guests the room, time, parking, and a day-of contact.", SUGGESTION_OFFSETS.speakerLogistics, deps(intake, ["date", "startTime", "venueName"]), "Outside speakers are involved.");
    s("sugg:room-check", "Walk through the room and test A/V", "Check seating, projector, and Wi-Fi.", SUGGESTION_OFFSETS.roomCheck, deps(intake, ["date", "venueName"]), "Event date is set.");
    s("sugg:follow-up", "Send thank-yous and record attendance", "Note attendance for future funding requests.", SUGGESTION_OFFSETS.followUp, deps(intake, ["date"]), "Event date is set.");
  }

  const until = today && intake.date ? daysBetween(today, intake.date) : null;
  const timingWarning =
    until !== null && until < 0
      ? "The event date is in the past. Update the date if the event moved, or use the plan for follow-up."
      : until !== null && until < 7
        ? `The event is ${until === 0 ? "today" : `${until} day${until === 1 ? "" : "s"} away`}. Tasks whose usual lead time has passed are flagged with a practical next step.`
        : null;
  return { tasks: raw.map((t) => finalize(t, intake, today)), scopeWarning, timingWarning, seekingFunding };
}

function question(id: string, title: string, detail: string, depValues: Record<string, string>): RawTask {
  return {
    id,
    type: "question",
    title,
    detail,
    conditionText: "This information is missing from the intake.",
    baseStatus: "missing_info",
    ruleId: null,
    target: null,
    deadlineNote: null,
    dependsOn: null,
    links: [],
    depValues,
  };
}
