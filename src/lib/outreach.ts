import { formatDate, formatTime } from "./dates";
import { KNOWN_EMAILS, RESOURCES, type Resource } from "./resources";
import { LABELS, type Draft, type Intake } from "./schema";

/**
 * Outreach drafts. Templates are filled only from the organizer's own event
 * details; anything missing becomes a [BRACKETED PLACEHOLDER]. EvntSC never
 * sends email or makes bookings — drafts are for copying.
 */

export type DraftKind = Draft["kind"];

/** Which draft kinds make sense for a resource. */
export function kindsForResource(r: Resource): DraftKind[] {
  if (r.kind === "catering") return ["catering"];
  if (r.kind === "venue") return ["venue", "campus_question"];
  return ["campus_question"];
}

/** A bracketed placeholder starts with a capital letter: [EVENT DATE], [EXACT DATE — currently “next month”]. */
export const PLACEHOLDER_RE = /\[[A-Z][^\]\n]*\]/g;

export function placeholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_RE) ?? [])];
}

export type EventFacts = {
  title: string;
  org: string;
  sender: string;
  date: string;
  time: string;
  attendance: string;
  guests: string;
  venue: string;
  food: string;
  budget: string;
};

/** Event details as text, with placeholders for anything unknown or unconfirmed. */
export function eventFacts(i: Intake): EventFacts {
  const time = i.startTime && i.endTime ? `${formatTime(i.startTime)} – ${formatTime(i.endTime)}` : i.startTime ? `starting ${formatTime(i.startTime)}` : "[START AND END TIME]";
  return {
    title: i.title.trim() || "[EVENT NAME]",
    org: i.organization.trim() || "[ORGANIZATION]",
    sender: i.organizerName.trim() || "[YOUR NAME]",
    date: i.date && i.dateConfirmed ? formatDate(i.date, { weekday: true }) : i.dateText.trim() ? `[EXACT DATE — currently “${i.dateText.trim()}”]` : "[EVENT DATE]",
    time,
    attendance: i.attendance !== null ? `about ${i.attendance}` : "[EXPECTED ATTENDANCE]",
    guests: i.guestCount !== null ? String(i.guestCount) : "[NUMBER OF GUESTS]",
    venue: i.venueName.trim() || "[VENUE — not booked yet]",
    food: i.food === "yes" ? "yes" : i.food === "no" ? "no" : "[FOOD: YES/NO]",
    budget: i.budgetTarget.trim() ? `$${i.budgetTarget.trim().replace(/^\$/, "")}` : "[BUDGET]",
  };
}

export function draftFromTemplate(kind: DraftKind, intake: Intake, resource: Resource | null): { to: string; subject: string; body: string } {
  const f = eventFacts(intake);
  const to = resource?.email ?? (resource ? `[EMAIL — needs verification for ${resource.name}]` : "[RECIPIENT EMAIL]");
  const greet = resource && resource.kind !== "catering" ? `Hello ${resource.name} team,` : "Hello,";
  const sign = `Thank you,\n${f.sender}\n${f.org}\n[YOUR USC EMAIL / PHONE]`;
  const headcount = intake.guestCount ? `${f.attendance} students plus ${f.guests} guests` : `${f.attendance} attendees`;

  switch (kind) {
    case "venue":
      return {
        to,
        subject: `Space request inquiry: ${f.title} on ${f.date}`,
        body: `${greet}

I'm planning ${f.title}, a ${LABELS.eventType[intake.eventType].toLowerCase()} hosted by ${f.org}, and I'd like to ask about available space.

- Date: ${f.date}
- Time: ${f.time}
- Expected attendance: ${headcount}
- Format: ${intake.eventType === "networking" ? "networking with open floor space or round tables" : "[ROOM SETUP]"}
- Food served: ${f.food}${intake.accessibility === "yes" ? `\n- Accessibility needs: ${intake.accessibilityNotes.trim() || "[ACCESSIBILITY NEEDS]"}` : ""}

Could you tell me which spaces might fit, whether there is a fee, and what our organization needs to submit to request one?

${sign}`,
      };
    case "catering":
      return {
        to,
        subject: `Catering quote request: ${f.title}, ${f.date}`,
        body: `${greet}

I'd like a quote for food at a student organization event.

- Event: ${f.title} (${f.org})
- Date and time: ${f.date}, ${f.time}
- Location: ${f.venue}
- Headcount: ${headcount}
- Service style: [BUFFET / BOXED / LIGHT APPETIZERS]
- Dietary needs: [DIETARY RESTRICTIONS]
- Our food budget: [FOOD BUDGET]

Could you send a written quote with per-person pricing, delivery or labor fees, and the latest date to place or change the order?

${sign}`,
      };
    case "guest_invite":
      return {
        to: "[GUEST EMAIL]",
        subject: `Invitation: ${f.title} with ${f.org}`,
        body: `Hello [GUEST NAME],

${f.org} is hosting ${f.title} and we'd love for you to join us${intake.eventType === "networking" ? " to meet and talk with students" : ""}.

- Date: ${f.date}
- Time: ${f.time}
- Location: ${f.venue}
- Expected students: ${f.attendance}
- What we're asking: [WHAT YOU'D LIKE THE GUEST TO DO]

Could you let us know by [RSVP DATE] whether you can attend? I'll send parking and arrival details once the room is confirmed.

${sign}`,
      };
    case "campus_question":
      return {
        to,
        subject: `Question about planning ${f.title} (${f.org})`,
        body: `${greet}

I'm planning ${f.title} for ${f.org} on ${f.date}, with ${headcount}.

My question: [YOUR QUESTION]

Is there anything our organization needs to submit or schedule for this, and by when?

${sign}`,
      };
    default:
      return { to, subject: `${f.title}: [SUBJECT]`, body: `${greet}\n\n[MESSAGE]\n\n${sign}` };
  }
}

/** Which resource a default draft for a task should address. */
export function defaultKindForTask(taskId: string): DraftKind {
  if (taskId.includes("catering") || taskId.includes("food")) return "catering";
  if (taskId.includes("guest") || taskId.includes("speaker")) return "guest_invite";
  if (taskId.includes("space") || taskId.includes("capacity") || taskId.includes("classroom") || taskId.includes("weather")) return "venue";
  return "campus_question";
}

/**
 * Replace any email address the AI wrote that isn't the recipient's verified
 * address or in the resource dataset. Model text can't introduce contacts.
 */
export function scrubEmails(text: string, allowed: string[] = []): string {
  const ok = new Set([...KNOWN_EMAILS, ...allowed.map((a) => a.toLowerCase())]);
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => (ok.has(m.toLowerCase()) ? m : "[EMAIL — needs verification]"));
}

export function resourceById(id: string | null): Resource | null {
  return id && Object.prototype.hasOwnProperty.call(RESOURCES, id) ? RESOURCES[id] : null;
}

export type RelevantResource = { resource: Resource; reasons: { taskId: string; title: string }[] };

/** Resources referenced by the plan's current tasks, with the tasks that make each one relevant. */
export function relevantResources(tasks: { id: string; title: string; applicable: boolean; status: string; derived: { resourceIds: string[] } | null }[]): RelevantResource[] {
  const map = new Map<string, RelevantResource>();
  for (const t of tasks) {
    if (!t.applicable || !t.derived) continue;
    for (const id of t.derived.resourceIds) {
      const r = resourceById(id);
      if (!r) continue;
      const entry = map.get(id) ?? { resource: r, reasons: [] };
      entry.reasons.push({ taskId: t.id, title: t.title });
      map.set(id, entry);
    }
  }
  const order: Record<string, number> = { venue: 0, catering: 1, campus_office: 2, accessibility: 3 };
  return [...map.values()].sort((a, b) => order[a.resource.kind] - order[b.resource.kind] || b.reasons.length - a.reasons.length);
}
