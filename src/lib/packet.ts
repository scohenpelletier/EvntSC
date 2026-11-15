import { relevantResources } from "./outreach";
import { formatDate, formatTime } from "./dates";
import { formatCents } from "./money";
import { computePlan } from "./plan";
import { RULES, SOURCES } from "./policy/registry";
import { LABELS, type PlanDoc } from "./schema";
import { STATUS_LABEL } from "./tasks/reconcile";

/** HTML-escape untrusted text (organizer input and model text alike). */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");

export type PacketMeta = {
  savedAt: string | null;
  generatedAt: string;
  today: string;
  isSample: boolean;
  /** Adds a Print button and auto-print hint for the in-browser view. */
  interactive: boolean;
};

export function renderPacketHtml(doc: PlanDoc, meta: PacketMeta): string {
  const c = computePlan(doc, meta.today);
  const i = doc.intake;
  const b = c.budget;
  const title = i.title.trim() || "Untitled event";
  const unk = (v: string | null | undefined, fallback = "Unknown") =>
    v && String(v).trim() ? esc(v) : `<span class="unknown">${fallback}</span>`;

  const usedRuleIds = new Set(c.tasks.filter((t) => t.applicable && t.ruleId).map((t) => t.ruleId!));
  const usedSourceIds = new Set([...usedRuleIds].map((id) => RULES[id]?.sourceId).filter(Boolean));

  const rows = doc.budget
    .map((line) => {
      const r = b.lines.find((l) => l.id === line.id)!;
      const amount = r.unknown
        ? '<span class="unknown">Cost unknown</span>'
        : r.amountCents === null
          ? `<span class="bad">Invalid: ${esc(r.errors.join("; "))}</span>`
          : formatCents(r.amountCents);
      return `<tr><td>${esc(line.description)}${line.notes ? `<div class="sub">${esc(line.notes)}</div>` : ""}</td><td>${esc(LABELS.category[line.category])}</td><td class="num">${esc(line.quantity)}</td><td class="num">${line.costUnknown ? "—" : esc(line.unitCost)}</td><td class="num">${amount}</td></tr>`;
    })
    .join("");

  const tasks = c.tasks
    .map((t) => {
      const rule = t.ruleId ? RULES[t.ruleId] : null;
      const src = rule ? SOURCES[rule.sourceId] : null;
      const typeLabel = t.type === "requirement" ? "Institutional requirement (cited)" : t.type === "suggestion" ? "Suggestion (EvntSC)" : t.type === "custom" ? "Organizer task" : "Open question";
      return `<tr class="${t.applicable ? "" : "na"}">
<td><strong>${esc(t.title)}</strong><div class="sub">${esc(typeLabel)}</div>${t.detail ? `<div class="sub">${esc(t.detail)}</div>` : ""}${
        t.recheckReasons.length ? `<div class="warn">Recheck: ${esc(t.recheckReasons.join("; "))}</div>` : ""
      }${rule && rule.passages.length ? `<blockquote>“${esc(rule.passages.join(" … "))}”<br><cite>${esc(src?.title)} — ${esc(src?.office)}</cite></blockquote>` : ""}${
        t.derived?.deadlineNote ? `<div class="sub">${esc(t.derived.deadlineNote)}</div>` : ""
      }</td>
<td>${esc(STATUS_LABEL[t.status])}${t.overdue ? ' <span class="bad">(target passed)</span>' : ""}</td>
<td>${t.targetDate ? `${esc(formatDate(t.targetDate))}<div class="sub">${esc(t.targetLabel)}</div>` : '<span class="unknown">—</span>'}</td>
<td>${t.state?.notes ? esc(t.state.notes) : ""}</td></tr>`;
    })
    .join("");

  const sources = Object.values(SOURCES)
    .filter((s) => usedSourceIds.has(s.id))
    .map(
      (s) =>
        `<li><strong>${esc(s.title)}</strong> (${esc(s.office)})<br><a href="${safeUrl(s.url)}">${esc(s.url)}</a><br><span class="sub">Reviewed ${esc(s.reviewedOn)}${s.pageUpdated ? ` · page last updated ${esc(s.pageUpdated)}` : ""}${s.accessible ? "" : " · could not be read by EvntSC — verify directly"}</span></li>`,
    )
    .join("");

  const contacts = relevantResources(c.tasks)
    .map(
      ({ resource: r, reasons }) =>
        `<li><strong>${esc(r.name)}</strong> — ${esc(r.role)}<br>${r.email ? `Email: ${esc(r.email)}` : '<span class="unknown">Email: needs verification</span>'} · ${
          r.phone ? `Phone: ${esc(r.phone)}` : '<span class="unknown">Phone: needs verification</span>'
        }${r.contactPage ? ` · <a href="${safeUrl(r.contactPage)}">${esc(r.contactPage)}</a>` : ""}<br><span class="sub">Relevant to: ${esc(reasons.map((x) => x.title).join("; "))} · ${
          r.verifiedOn ? `checked ${esc(r.verifiedOn)} against ${esc(r.sourceUrl)}` : "not checked"
        }</span></li>`,
    )
    .join("");

  const openQs = doc.questions.filter((q) => !q.resolved);
  const answeredQs = doc.questions.filter((q) => q.resolved);

  const findings = b.findings
    .map((f) => `<li class="${f.severity}"><strong>${esc(f.title)}</strong> — ${esc(f.detail)} <span class="sub">(${esc(f.basis)})</span></li>`)
    .join("");

  const aiNotes = doc.aiNotes.length
    ? `<h2>AI suggestions (unverified)</h2><p class="sub">Generated text, shown for reference. Not a source.</p><ul>${doc.aiNotes
        .map((n) => `<li><strong>${esc(RULES[n.ruleId]?.title ?? n.ruleId)}:</strong> ${esc(n.text)}</li>`)
        .join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — EvntSC planning packet</title>
<style>
:root{--ink:#24211e;--muted:#5f5953;--line:#ddd5cb;--paper:#fbf8f3;--cardinal:#990000}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:900px;margin:0 auto;padding:32px 20px 64px}
h1{font-family:Georgia,"Times New Roman",serif;font-size:30px;margin:0 0 4px}h2{font-family:Georgia,serif;font-size:19px;margin:28px 0 8px;border-bottom:2px solid var(--cardinal);padding-bottom:4px;break-after:avoid}
.disclaimer{border:1px solid var(--line);background:#fff;padding:10px 12px;font-size:12px;color:var(--muted);margin:12px 0}
dl{display:grid;grid-template-columns:200px 1fr;gap:4px 16px;margin:0}dt{color:var(--muted)}dd{margin:0}
table{width:100%;border-collapse:collapse;table-layout:fixed;word-wrap:break-word}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
tr{break-inside:avoid}thead{display:table-header-group}.num{text-align:right;white-space:nowrap}
.sub{color:var(--muted);font-size:12px}.unknown{color:#8a5a00;font-style:italic}.bad{color:var(--cardinal);font-weight:600}.warn{color:#8a5a00;font-weight:600;font-size:12px}
blockquote{margin:6px 0;padding:4px 10px;border-left:3px solid var(--line);font-size:12px;color:var(--muted)}cite{font-style:normal}
.totals td{font-weight:600}li{margin-bottom:6px}li.issue strong{color:var(--cardinal)}tr.na td{color:var(--muted)}
.toolbar{position:sticky;top:0;background:var(--paper);padding:8px 0;display:flex;gap:8px}button{font:inherit;padding:6px 14px;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:6px;cursor:pointer}
@media print{.toolbar{display:none}body{background:#fff;font-size:11.5px}main{padding:0;max-width:none}a{color:var(--ink)}h2{margin-top:18px}@page{margin:14mm}}
@media (max-width:600px){dl{grid-template-columns:1fr}dt{font-weight:600;margin-top:6px}table{font-size:12px}}
</style></head><body><main>
${meta.interactive ? '<div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>' : ""}
<p class="sub">EvntSC planning packet${meta.isSample ? " · FICTIONAL SAMPLE" : ""}</p>
<h1>${esc(title)}</h1>
<p class="sub">${meta.savedAt ? `Matches the plan saved ${esc(meta.savedAt)}` : "Local demo plan (not saved to an account)"} · generated ${esc(meta.generatedAt)}</p>
<div class="disclaimer">Preparation document only — not an official application, approval, or funding decision. EvntSC is an independent student-built prototype and is not endorsed by USC. Policy passages were reviewed on the dates shown and may have changed; follow the links to confirm.</div>
${c.evaluation.scopeWarning ? `<div class="disclaimer"><strong>Scope limitation:</strong> ${esc(c.evaluation.scopeWarning)}</div>` : ""}

<h2>Event summary</h2>
<dl>
<dt>Type</dt><dd>${esc(LABELS.eventType[i.eventType])}</dd>
<dt>Organizer</dt><dd>${unk(i.organizerName)}${i.organization ? ` · ${esc(i.organization)}` : ""}</dd>
<dt>Date</dt><dd>${i.date ? esc(formatDate(i.date, { weekday: true })) + (i.dateConfirmed ? "" : ' <span class="unknown">(unconfirmed)</span>') : i.dateText ? `“${esc(i.dateText)}” <span class="unknown">(exact date unknown)</span>` : unk(null)}</dd>
<dt>Time (America/Los_Angeles)</dt><dd>${i.startTime && i.endTime ? `${esc(formatTime(i.startTime))} – ${esc(formatTime(i.endTime))}` : unk(null)}</dd>
<dt>Expected attendance</dt><dd>${i.attendance ?? unk(null)}</dd>
<dt>Outside guests</dt><dd>${i.outsideSpeakers === "yes" ? (i.guestCount !== null ? String(i.guestCount) : unk(null)) : esc(LABELS.tri[i.outsideSpeakers])}</dd>
<dt>Accessibility needs</dt><dd>${i.accessibility === "yes" ? esc(i.accessibilityNotes || "Yes") : esc(LABELS.tri[i.accessibility])}</dd>
<dt>Venue</dt><dd>${unk(i.venueName)} · ${esc(LABELS.venueType[i.venueType])} · ${esc(LABELS.venueStatus[i.venueStatus])}</dd>
<dt>Recognition status</dt><dd>${esc(LABELS.recognition[i.recognition])}</dd>
<dt>Food / speakers / vendors</dt><dd>Food: ${esc(LABELS.tri[i.food])} · Outside speakers: ${esc(LABELS.tri[i.outsideSpeakers])} · Vendors: ${esc(LABELS.tri[i.vendors])} (${esc(LABELS.vendorStatus[i.vendorStatus])})</dd>
<dt>Fundraising</dt><dd>${esc(LABELS.tri[i.fundraising])}</dd>
</dl>
${i.description ? `<p>${esc(i.description)}</p>` : ""}
${c.unknownDetails.length ? `<p><strong>Still unknown:</strong> <span class="unknown">${esc(c.unknownDetails.join(", "))}</span></p>` : "<p>No unknown intake details.</p>"}
${c.schedule.errors.length ? `<p class="bad">${esc(c.schedule.errors.join(" "))}</p>` : ""}
${c.schedule.needsConfirmation.length ? `<p class="warn">${esc(c.schedule.needsConfirmation.join(" "))}</p>` : ""}

<h2>Budget</h2>
${
  doc.budget.length
    ? `<table><thead><tr><th style="width:38%">Item</th><th>Category</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>`
    : "<p>No expense lines.</p>"
}
<table style="margin-top:10px"><tbody class="totals">
<tr><td>Known subtotal</td><td class="num">${formatCents(b.knownSubtotalCents)}</td></tr>
<tr><td>Total</td><td class="num">${b.totalCents !== null ? formatCents(b.totalCents) : `<span class="unknown">Not calculated — ${b.unknownCount} unknown, ${b.invalidCount} invalid</span>`}</td></tr>
<tr><td>Organizer budget target</td><td class="num">${b.target.cents !== null ? formatCents(b.target.cents) : '<span class="unknown">Not set</span>'}</td></tr>
<tr><td>Funding requested (not awarded)</td><td class="num">${b.requested.cents !== null ? formatCents(b.requested.cents) : "—"}</td></tr>
<tr><td>Confirmed funding (organizer-reported)</td><td class="num">${b.confirmed.cents !== null ? formatCents(b.confirmed.cents) : "—"}</td></tr>
</tbody></table>
${findings ? `<h3>Budget findings</h3><ul>${findings}</ul>` : ""}

<h2>Checklist and timeline</h2>
<p class="sub">All dates are in America/Los_Angeles. “Suggested” dates are EvntSC defaults, not USC deadlines. Academic-week rules are never converted to calendar dates.</p>
<table><thead><tr><th style="width:50%">Task</th><th>Status</th><th>Target</th><th>Notes</th></tr></thead><tbody>${tasks}</tbody></table>

<h2>Contacts</h2>
${contacts ? `<p class="sub">Copied from official pages on the dates shown. Availability, prices, and approval are not checked by EvntSC.</p><ul>${contacts}</ul>` : "<p>No campus contacts match the current plan.</p>"}

<h2>Outstanding questions and assumptions</h2>
${doc.assumptions.length ? `<h3>Assumptions to confirm</h3><ul>${doc.assumptions.map((a) => `<li>${esc(a.text)}${a.source === "demo" ? ' <span class="sub">(demo fixture)</span>' : a.source === "ai" ? ' <span class="sub">(AI)</span>' : ""}</li>`).join("")}</ul>` : ""}
${openQs.length ? `<ul>${openQs.map((q) => `<li>${esc(q.text)}</li>`).join("")}</ul>` : "<p>No organizer questions recorded.</p>"}
${answeredQs.length ? `<h3>Answered</h3><ul>${answeredQs.map((q) => `<li>${esc(q.text)} — ${esc(q.answer)}</li>`).join("")}</ul>` : ""}
${i.notes ? `<h3>Organizer notes</h3><p>${esc(i.notes)}</p>` : ""}
${aiNotes}

<h2>Sources</h2>
${sources ? `<ul>${sources}</ul>` : "<p>No institutional sources apply to the current plan.</p>"}
</main></body></html>`;
}
