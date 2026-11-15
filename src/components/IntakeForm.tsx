"use client";
import { useState } from "react";
import { checkSchedule, resolveWallTime } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { LABELS, type Intake } from "@/lib/schema";
import { Alert, Button, SelectField, TextArea, TextField } from "./ui";

type Props = { intake: Intake; onChange: (patch: Partial<Intake>) => void };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <legend className="font-display text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function moneyError(v: string) {
  const p = parseMoney(v);
  return p.kind === "invalid" ? p.reason : null;
}

export function IntakeForm({ intake, onChange }: Props) {
  // Parent remounts this form (via `key`) whenever the intake is replaced wholesale.
  const [attendanceText, setAttendanceText] = useState(intake.attendance?.toString() ?? "");
  const attendanceError =
    attendanceText !== "" && !(Number.isInteger(Number(attendanceText)) && Number(attendanceText) > 0 && Number(attendanceText) <= 100000)
      ? "Enter a whole number greater than zero."
      : null;

  const schedule = checkSchedule(intake);
  const ambiguous =
    intake.date && intake.startTime ? resolveWallTime(intake.date, intake.startTime) : null;

  return (
    <div className="space-y-5">
      <Section title="Basics">
        <TextField label="Event title" value={intake.title} maxLength={160} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Resume Review Workshop" />
        <SelectField
          label="Event type"
          value={intake.eventType}
          onChange={(v) => onChange({ eventType: v })}
          options={LABELS.eventType}
        />
        <TextField label="Purpose (optional)" value={intake.purpose} maxLength={300} onChange={(e) => onChange({ purpose: e.target.value })} placeholder="e.g. Connect members with alumni in tech" />
        <TextArea label="Description" rows={3} maxLength={4000} value={intake.description} onChange={(e) => onChange({ description: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Organizer name" value={intake.organizerName} maxLength={120} onChange={(e) => onChange({ organizerName: e.target.value })} />
          <TextField label="Organization (if any)" value={intake.organization} maxLength={160} onChange={(e) => onChange({ organization: e.target.value })} />
        </div>
      </Section>

      <Section title="When">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Date" type="date" value={intake.date ?? ""} onChange={(e) => onChange({ date: e.target.value || null, dateConfirmed: true, dstChoice: null })} />
          <TextField label="Start time" type="time" value={intake.startTime ?? ""} onChange={(e) => onChange({ startTime: e.target.value || null, dstChoice: null })} />
          <TextField label="End time" type="time" value={intake.endTime ?? ""} onChange={(e) => onChange({ endTime: e.target.value || null })} />
        </div>
        {!intake.date && (
          <TextField
            label="Timing so far (optional)"
            value={intake.dateText}
            maxLength={120}
            onChange={(e) => onChange({ dateText: e.target.value })}
            placeholder="e.g. next month, a Thursday in March"
          />
        )}
        {intake.date && !intake.dateConfirmed && (
          <Alert tone="warning" title="Date needs confirmation">
            <p>This date was read from your description and may be missing a year or be ambiguous.</p>
            <Button size="sm" className="mt-2" onClick={() => onChange({ dateConfirmed: true })}>
              Yes, this date is correct
            </Button>
          </Alert>
        )}
        {ambiguous?.kind === "ambiguous" && (
          <fieldset className="rounded-md border border-amber/40 bg-amber-wash p-3 text-sm">
            <legend className="px-1 font-semibold">Daylight-saving time: which occurrence?</legend>
            <p className="mb-2">{ambiguous.message}</p>
            {(["earlier", "later"] as const).map((c) => (
              <label key={c} className="mr-4 inline-flex items-center gap-2">
                <input type="radio" name="dst" checked={intake.dstChoice === c} onChange={() => onChange({ dstChoice: c })} />
                {c === "earlier" ? "First (PDT, UTC−7)" : "Second (PST, UTC−8)"}
              </label>
            ))}
          </fieldset>
        )}
        {schedule.errors.map((e) => (
          <Alert key={e} tone="error">
            {e}
          </Alert>
        ))}
      </Section>

      <Section title="Where and who">
        <TextField
          label="Expected attendance"
          inputMode="numeric"
          value={attendanceText}
          error={attendanceError}
          onChange={(e) => {
            const t = e.target.value.trim();
            setAttendanceText(t);
            const n = Number(t);
            onChange({ attendance: t !== "" && Number.isInteger(n) && n > 0 && n <= 100000 ? n : null });
          }}
        />
        <TextField label="Venue / location" value={intake.venueName} maxLength={160} onChange={(e) => onChange({ venueName: e.target.value })} placeholder="Room or space, if known" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Venue type" value={intake.venueType} onChange={(v) => onChange({ venueType: v })} options={LABELS.venueType} />
          <SelectField
            label="Has space been requested or confirmed?"
            value={intake.venueStatus}
            onChange={(v) => onChange({ venueStatus: v })}
            options={LABELS.venueStatus}
          />
        </div>
        <SelectField
          label="Organization recognition status"
          value={intake.recognition}
          onChange={(v) => onChange({ recognition: v })}
          options={LABELS.recognition}
        />
      </Section>

      <Section title="Food, speakers, vendors">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Food served?" value={intake.food} onChange={(v) => onChange({ food: v })} options={LABELS.tri} />
          <SelectField label="Outside speakers or guests?" value={intake.outsideSpeakers} onChange={(v) => onChange({ outsideSpeakers: v })} options={LABELS.tri} />
          {intake.outsideSpeakers === "yes" && (
            <GuestCount value={intake.guestCount} onChange={(n) => onChange({ guestCount: n })} />
          )}
          {intake.outsideSpeakers === "yes" && (
            <SelectField
              label="Celebrity, political leader, or dignitary?"
              value={intake.highProfileGuest}
              onChange={(v) => onChange({ highProfileGuest: v })}
              options={LABELS.tri}
            />
          )}
          <SelectField label="Vendors (A/V, rentals, etc.)?" value={intake.vendors} onChange={(v) => onChange({ vendors: v, vendorStatus: v === "no" ? "none_needed" : intake.vendorStatus })} options={LABELS.tri} />
          {intake.vendors !== "no" && <SelectField label="Vendor status" value={intake.vendorStatus} onChange={(v) => onChange({ vendorStatus: v })} options={LABELS.vendorStatus} />}
          <SelectField label="Fundraising (sales, tickets, donations)?" value={intake.fundraising} onChange={(v) => onChange({ fundraising: v })} options={LABELS.tri} />
        </div>
      </Section>

      <Section title="Accessibility">
        <SelectField
          label="Known accessibility needs?"
          value={intake.accessibility}
          onChange={(v) => onChange({ accessibility: v })}
          options={LABELS.tri}
        />
        {intake.accessibility === "yes" && (
          <TextArea
            label="What's needed"
            rows={2}
            maxLength={1000}
            value={intake.accessibilityNotes}
            onChange={(e) => onChange({ accessibilityNotes: e.target.value })}
            placeholder="e.g. step-free entrance for a guest using a wheelchair"
          />
        )}
      </Section>

      <Section title="Money">
        <TextField
          label="Your budget target ($)"
          inputMode="decimal"
          value={intake.budgetTarget}
          error={moneyError(intake.budgetTarget)}
          onChange={(e) => onChange({ budgetTarget: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Funding requested ($)"
            inputMode="decimal"
            value={intake.fundingRequested}
            error={moneyError(intake.fundingRequested)}
            onChange={(e) => onChange({ fundingRequested: e.target.value })}
          />
          <TextField
            label="Confirmed funding ($)"
            inputMode="decimal"
            value={intake.fundingConfirmed}
            error={moneyError(intake.fundingConfirmed)}
            onChange={(e) => onChange({ fundingConfirmed: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Notes">
        <TextArea label="Notes and assumptions" rows={3} maxLength={4000} value={intake.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Section>
    </div>
  );
}

function GuestCount({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const [text, setText] = useState(value?.toString() ?? "");
  const n = Number(text);
  const valid = text === "" || (Number.isInteger(n) && n >= 0 && n <= 10000);
  return (
    <TextField
      label="How many outside guests?"
      inputMode="numeric"
      value={text}
      error={valid ? null : "Enter a whole number."}
      onChange={(e) => {
        const t = e.target.value.trim();
        setText(t);
        const v = Number(t);
        onChange(t !== "" && Number.isInteger(v) && v >= 0 && v <= 10000 ? v : null);
      }}
    />
  );
}
