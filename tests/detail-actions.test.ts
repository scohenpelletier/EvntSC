import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DETAIL_ACTIONS } from "@/lib/tasks/detail-actions";

// The "Add …" buttons find their field by its label, so a renamed label or task would silently break them.
const form = readFileSync("src/components/IntakeForm.tsx", "utf8");
const engine = readFileSync("src/lib/policy/engine.ts", "utf8");

describe("checklist detail buttons", () => {
  it.each(Object.entries(DETAIL_ACTIONS))("%s points at a real task and a real form field", (taskId, action) => {
    expect(engine).toContain(`"${taskId}"`);
    expect(form).toContain(`"${action.field}"`);
  });
});
