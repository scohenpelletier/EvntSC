/**
 * Vetted USC policy-source registry (read-only, versioned project data).
 *
 * Every passage below was read from the official page on REVIEWED_ON and is
 * quoted verbatim (trimmed). Rules only claim what their passage supports.
 * Anything EvntSC could not read is modelled as a question, never a rule.
 *
 * This registry is an independent student-built aid. It is not maintained or
 * endorsed by USC, and pages can change after review — always follow the link.
 */

export const REGISTRY_VERSION = "2026-11-12.1";
export const REVIEWED_ON = "2026-11-12";

export type PolicySource = {
  id: string;
  title: string;
  office: string;
  url: string;
  reviewedOn: string;
  /** "Last updated" shown on the page itself, if any. */
  pageUpdated: string | null;
  contact: string | null;
  accessible: boolean;
};

export const SOURCES: Record<string, PolicySource> = {
  "usg-funding": {
    id: "usg-funding",
    title: "USG Funding Department",
    office: "Undergraduate Student Government",
    url: "https://usg.usc.edu/branches/funding/",
    reviewedOn: REVIEWED_ON,
    pageUpdated: null,
    contact: "usgfunds@usc.edu",
    accessible: true,
  },
  "usg-funding-guidelines": {
    id: "usg-funding-guidelines",
    title: "26-27 Funding Department Guidelines (linked from USG Funding)",
    office: "Undergraduate Student Government",
    url: "https://docs.google.com/document/d/1noJFJ4SxrFGD1Zm-6EqUHpXSIOUuFIL-gIobWXcXCt0/edit?usp=sharing",
    reviewedOn: REVIEWED_ON,
    pageUpdated: null,
    contact: "usgfunds@usc.edu",
    accessible: false,
  },
  "rso-resources": {
    id: "rso-resources",
    title: "RSO Resources",
    office: "USC Campus Activities",
    url: "https://campusactivities.usc.edu/programs/recognized-student-organizations/rso-resources/",
    reviewedOn: REVIEWED_ON,
    pageUpdated: "2026-07-10",
    contact: "Campus Activities, SKS 410, 213-740-5649",
    accessible: true,
  },
  "tes-approvals": {
    id: "tes-approvals",
    title: "Departmental Event Approvals",
    office: "Trojan Event Services",
    url: "https://trojanevents.usc.edu/departmental-event-approvals/",
    reviewedOn: REVIEWED_ON,
    pageUpdated: null,
    contact: "SCevents@usc.edu, (213) 764-4943",
    accessible: true,
  },
  "tes-forms": {
    id: "tes-forms",
    title: "Forms and Permits",
    office: "Trojan Event Services",
    url: "https://trojanevents.usc.edu/forms-and-permits/",
    reviewedOn: REVIEWED_ON,
    pageUpdated: null,
    contact: "SCevents@usc.edu",
    accessible: true,
  },
};

export type Link = { label: string; url: string };

/** How (and whether) a rule's timing can be turned into a date. */
export type DeadlineSpec =
  /** Counted in academic weeks — never converted to calendar dates. */
  | { type: "academic_weeks"; weeks: number; wording: string }
  /** Tied to a numbered week of the term — needs the academic calendar. */
  | { type: "term_week"; week: number; wording: string }
  /** Stated in plain weeks/days before the event — safe to compute. */
  | { type: "calendar_days_before"; days: number; wording: string };

export type Rule = {
  id: string;
  sourceId: keyof typeof SOURCES | string;
  title: string;
  /** Verbatim supporting passage(s) from the source. */
  passages: string[];
  effectiveDate: string | null;
  /** Plain-language applicability condition shown to the organizer. */
  conditionText: string;
  deadline: DeadlineSpec | null;
  links: Link[];
};

export const RULES: Record<string, Rule> = {
  "usg-applicant-eligibility": {
    id: "usg-applicant-eligibility",
    sourceId: "usg-funding",
    title: "USG funding application is for RSOs and USC undergraduates",
    passages: [
      "This form is to be used by Recognized Student Organizations and USC undergraduate students to request funds from the USG Funding Department.",
    ],
    effectiveDate: null,
    conditionText: "Applies when you plan to request USG funding.",
    deadline: null,
    links: [
      { label: "USG Funding page (application link)", url: "https://usg.usc.edu/branches/funding/" },
    ],
  },
  "usg-application-deadline": {
    id: "usg-application-deadline",
    sourceId: "usg-funding",
    title: "USG funding application timing (academic weeks)",
    passages: [
      "Applications must be submitted on Wednesdays by 11:59 PM six academic weeks before the event date",
      "…and or nine academic weeks before the initial payment due date (whichever comes first) for approved USC Vendors.",
    ],
    effectiveDate: null,
    conditionText: "Applies when you plan to request USG funding.",
    deadline: {
      type: "academic_weeks",
      weeks: 6,
      wording: "six academic weeks before the event date (nine academic weeks before the initial payment due date for approved USC vendors, whichever comes first)",
    },
    links: [{ label: "USG Funding FAQ", url: "https://usg.usc.edu/branches/funding/" }],
  },
  "usg-event-cap": {
    id: "usg-event-cap",
    sourceId: "usg-funding",
    title: "USG funding limit per organization",
    passages: [
      "Each RSO can have up to 4 events funded per semester as long as it remains under $8,000 from the USG Funding Department per year.",
      "Funding is not guaranteed and depends on various factors",
    ],
    effectiveDate: null,
    conditionText: "Applies when you plan to request USG funding.",
    deadline: null,
    links: [{ label: "USG Funding page", url: "https://usg.usc.edu/branches/funding/" }],
  },
  "usg-guidelines-unverified": {
    id: "usg-guidelines-unverified",
    sourceId: "usg-funding-guidelines",
    title: "Read the full USG Funding Guidelines (EvntSC could not verify them)",
    passages: [],
    effectiveDate: null,
    conditionText: "Applies when you plan to request USG funding.",
    deadline: null,
    links: [
      { label: "Funding Guidelines document", url: "https://docs.google.com/document/d/1noJFJ4SxrFGD1Zm-6EqUHpXSIOUuFIL-gIobWXcXCt0/edit?usp=sharing" },
    ],
  },
  "rso-space-request": {
    id: "rso-space-request",
    sourceId: "rso-resources",
    title: "Request event space through Trojan Event Services",
    passages: [
      "Recognized Student Organizations in good standing can request to book space on campus.",
      "please submit an online reservation request on the Trojan Event Services website.",
    ],
    effectiveDate: null,
    conditionText: "Applies when your venue is not yet confirmed and is (or may be) a TES-managed event space or outdoor venue.",
    deadline: null,
    links: [
      { label: "Trojan Event Services — venues & reservation requests", url: "https://trojanevents.usc.edu/venues/" },
    ],
  },
  "rso-classroom-week4": {
    id: "rso-classroom-week4",
    sourceId: "rso-resources",
    title: "Classroom requests open in Week 4 of the term",
    passages: ["Classroom Scheduling accepts requests for classroom spaces starting Week 4."],
    effectiveDate: null,
    conditionText: "Applies when you want a classroom that is not yet confirmed.",
    deadline: { type: "term_week", week: 4, wording: "starting Week 4" },
    links: [
      { label: "Classroom space request form", url: "https://usccampusactivities.wufoo.com/forms/classroom-space-request-form/" },
    ],
  },
  "rso-fundraising-uepa": {
    id: "rso-fundraising-uepa",
    sourceId: "rso-resources",
    title: "Fundraising events need a UEPA and a Campus Activities meeting",
    passages: [
      "RSOs must submit a USC Events Permit Application (UEPA) for any events involving fundraising",
      "meet with Campus Activities at least two weeks prior for fundraising approval.",
    ],
    effectiveDate: null,
    conditionText: "Applies when the event involves fundraising (ticket sales, donations, sales).",
    deadline: { type: "calendar_days_before", days: 14, wording: "at least two weeks prior" },
    links: [
      { label: "USC Event Permit Application", url: "https://usc-its.my.site.com/eventpermits/s/request-submission" },
      { label: "Fundraising Approval Request Form (TES)", url: "https://trojanevents.usc.edu/wp-content/uploads/2024/11/Fundraising-Approval-Form-FY25.pdf" },
    ],
  },
  "rso-handbook-social": {
    id: "rso-handbook-social",
    sourceId: "rso-resources",
    title: "Check Student Handbook social-event policies",
    passages: ["Please be sure to adhere to the policies regarding social events as outlined in the Student Handbook."],
    effectiveDate: null,
    conditionText: "Whether a workshop counts as a “social event” is not defined on this page — confirm.",
    deadline: null,
    links: [{ label: "USC Student Handbook", url: "https://policy.usc.edu/studenthandbook/" }],
  },
  "tes-catering": {
    id: "tes-catering",
    sourceId: "tes-approvals",
    title: "Use an on-campus caterer or confirm outside catering is allowed",
    passages: [
      "USC Hospitality and the University Club are the only on campus caterers.",
      "Outside caterers are allowed in certain venues.",
    ],
    effectiveDate: null,
    conditionText: "Applies when food will be served.",
    deadline: null,
    links: [
      { label: "Catering approvals (USC Hospitality)", url: "http://cateringapprovals.usc.edu/" },
      { label: "TES departmental approvals", url: "https://trojanevents.usc.edu/departmental-event-approvals/" },
    ],
  },
  "tes-high-profile-guest": {
    id: "tes-high-profile-guest",
    sourceId: "tes-approvals",
    title: "High-profile guests require additional approval",
    passages: ["Approval required for events involving celebrities, political leaders and dignitaries."],
    effectiveDate: null,
    conditionText: "Applies when an outside guest is a celebrity, political leader, or dignitary.",
    deadline: null,
    links: [{ label: "TES departmental approvals", url: "https://trojanevents.usc.edu/departmental-event-approvals/" }],
  },
};

export function isKnownRuleId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(RULES, id);
}

/**
 * EvntSC's own planning suggestions. These are NOT USC requirements and
 * their offsets are EvntSC defaults, documented here, not official dates.
 */
export const SUGGESTION_OFFSETS = {
  promote: -14,
  speakerLogistics: -7,
  foodHeadcount: -7,
  roomCheck: -1,
  followUp: 2,
} as const;
