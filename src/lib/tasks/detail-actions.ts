/**
 * Checklist tasks that are answered by filling in an event detail. Each one gets a button that
 * opens Edit details at that field; once the detail is filled in, the task clears itself.
 * `field` is the visible label of the field in the details form (IntakeForm).
 */
export type DetailAction = { label: string; field: string };

export const DETAIL_ACTIONS: Record<string, DetailAction> = {
  "q:date": { label: "Add date", field: "Date" },
  "q:date-confirm": { label: "Confirm date", field: "Date" },
  "q:time": { label: "Add times", field: "Start time" },
  "q:attendance": { label: "Add attendance", field: "Expected attendance" },
  "q:venue": { label: "Add venue status", field: "Has space been requested or confirmed?" },
  "q:food": { label: "Add food decision", field: "Food served?" },
  "q:speakers": { label: "Add guest details", field: "Outside speakers or guests?" },
  "q:high-profile": { label: "Answer this question", field: "Celebrity, political leader, or dignitary?" },
  "q:fundraising": { label: "Add fundraising decision", field: "Fundraising (sales, tickets, donations)?" },
  "q:vendor-rules": { label: "Add vendor details", field: "Vendors (A/V, rentals, etc.)?" },
};
