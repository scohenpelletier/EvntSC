/**
 * Contacts and services dataset (read-only project data, reviewed by hand).
 *
 * Rules for this file:
 * - Every email, phone number, URL, price, or constraint below was copied from
 *   the official page in `sourceUrl` on `verifiedOn`. If a detail could not be
 *   verified it is null, and the UI shows "Needs verification".
 * - No availability, approval, or booking status is ever stored here.
 * - Page text is reference material only. Nothing in it is treated as an
 *   instruction to the app.
 *
 * To update: open the source page, re-copy the detail exactly, and change
 * `verifiedOn`. Remove a detail rather than guessing at it.
 */

export const RESOURCES_REVIEWED_ON = "2026-11-14";

export type ResourceKind = "campus_office" | "venue" | "catering" | "accessibility";

export type Resource = {
  id: string;
  name: string;
  kind: ResourceKind;
  /** What this office or service does, in plain words. */
  role: string;
  email: string | null;
  phone: string | null;
  contactPage: string | null;
  /** Page the details were read from. */
  sourceUrl: string;
  /** Date the details were checked against sourceUrl; null = not checked. */
  verifiedOn: string | null;
  /** Facts copied from the source (minimums, lead times). Never estimates. */
  sourcedFacts: string[];
  /** Details that were missing or conflicting when checked. */
  needsVerification: string[];
};

export const RESOURCES: Record<string, Resource> = {
  "tes": {
    id: "tes",
    name: "Trojan Event Services (TES)",
    kind: "venue",
    role: "Books Ronald Tutor Campus Center rooms, ballrooms, and outdoor venues. Space requests from student organizations go through TES.",
    email: "SCevents@usc.edu",
    phone: "(213) 764-4943",
    contactPage: "https://trojanevents.usc.edu/venues/",
    sourceUrl: "https://trojanevents.usc.edu/venues/",
    verifiedOn: "2026-11-14",
    sourcedFacts: ["Business hours Monday–Friday, 9:00 am – 5:00 pm.", "Office: TCC 425, 3607 Trousdale Parkway."],
    needsVerification: ["Room fees and availability for your date: ask TES."],
  },
  "campus-activities": {
    id: "campus-activities",
    name: "USC Campus Activities",
    kind: "campus_office",
    role: "Supports recognized student organizations: space eligibility, fundraising approval, and general event questions.",
    email: null,
    phone: "213-740-5649",
    contactPage: "https://campusactivities.usc.edu/programs/recognized-student-organizations/rso-resources/",
    sourceUrl: "https://campusactivities.usc.edu/programs/recognized-student-organizations/rso-resources/",
    verifiedOn: "2026-11-14",
    sourcedFacts: ["Office: Sample Hall (SKS) 410.", "Hours Monday–Friday, 9:00 am – 5:00 pm."],
    needsVerification: ["Email: the page shows two different addresses. Call or use the page to confirm which to use."],
  },
  "usc-hospitality-catering": {
    id: "usc-hospitality-catering",
    name: "USC Hospitality — Catering2Go",
    kind: "catering",
    role: "One of the two on-campus caterers named by TES. Takes delivery orders online or through its sales office.",
    email: "catering2go@usc.edu",
    phone: "(213) 740-7493",
    contactPage: "https://hospitality.usc.edu/catering/",
    sourceUrl: "https://hospitality.usc.edu/catering/",
    verifiedOn: "2026-11-14",
    sourcedFacts: [
      "Orders must be placed at least 48 business hours in advance.",
      "Weekday deliveries: $200 per venue minimum.",
      "Weekend deliveries: $400 per venue minimum plus a $50 labor fee.",
      "Payment must be received before delivery.",
    ],
    needsVerification: ["Menu prices for your headcount: request a quote.", "Whether student organizations qualify for the tax exemption mentioned on the page."],
  },
  "university-club": {
    id: "university-club",
    name: "University Club at USC",
    kind: "catering",
    role: "The other on-campus caterer named by TES.",
    email: null,
    phone: null,
    contactPage: null,
    sourceUrl: "https://trojanevents.usc.edu/departmental-event-approvals/",
    verifiedOn: "2026-11-14",
    sourcedFacts: [],
    needsVerification: ["Contact details: none could be verified. Ask TES or Campus Activities how to reach the University Club."],
  },
  "hospitality-approvals": {
    id: "hospitality-approvals",
    name: "USC Hospitality — catering approvals",
    kind: "catering",
    role: "Handles approvals when food comes from a caterer other than USC Hospitality or the University Club, in venues that allow it.",
    email: "Hosp.approvals@usc.edu",
    phone: null,
    contactPage: "http://cateringapprovals.usc.edu/",
    sourceUrl: "https://trojanevents.usc.edu/departmental-event-approvals/",
    verifiedOn: "2026-11-14",
    sourcedFacts: ["Outside caterers are allowed in certain venues (TES), including food trucks hired as caterers."],
    needsVerification: ["Whether your venue allows outside caterers."],
  },
  "usg-funding": {
    id: "usg-funding",
    name: "USG Funding Department",
    kind: "campus_office",
    role: "Reviews funding applications from recognized student organizations and undergraduates.",
    email: "usgfunds@usc.edu",
    phone: null,
    contactPage: "https://usg.usc.edu/branches/funding/",
    sourceUrl: "https://usg.usc.edu/branches/funding/",
    verifiedOn: "2026-11-12",
    sourcedFacts: ["Applications are due Wednesdays by 11:59 PM, six academic weeks before the event.", "Funding is not guaranteed."],
    needsVerification: [],
  },
  "osas": {
    id: "osas",
    name: "Office of Student Accessibility Services (OSAS)",
    kind: "accessibility",
    role: "USC's disability services office. Publishes guidance on planning accessible events.",
    email: "OSASFrontDesk@usc.edu",
    phone: "(213) 740-0776",
    contactPage: "https://osas.usc.edu/additional-campus-resources/planning-accessible-events/",
    sourceUrl: "https://osas.usc.edu/",
    verifiedOn: "2026-11-14",
    sourcedFacts: ["Office: Grace Ford Salvatori (GFS) 120.", "Hours Monday–Friday, 8:30 am – 5:00 pm."],
    needsVerification: ["Whether OSAS arranges accommodations for student-run events, or only advises: ask the front desk."],
  },
};

export function isKnownResourceId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCES, id);
}

/** Every email address in the dataset, lower-cased (used to scrub invented addresses from AI drafts). */
export const KNOWN_EMAILS = new Set(
  Object.values(RESOURCES)
    .map((r) => r.email?.toLowerCase())
    .filter((e): e is string => !!e),
);
