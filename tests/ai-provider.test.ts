import { describe, expect, it } from "vitest";
import { aiIntakeSchema, aiReviewSchema, pickProvider, toJsonSchema } from "@/lib/ai/core";

describe("AI provider selection", () => {
  it("is null with no keys (manual mode)", () => {
    expect(pickProvider({})).toBeNull();
    expect(pickProvider({ AI_PROVIDER: "gemini" })).toBeNull();
  });
  it("honors AI_PROVIDER only when that provider has a key", () => {
    const both = { GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" };
    expect(pickProvider({ ...both, AI_PROVIDER: "anthropic" })).toBe("anthropic");
    expect(pickProvider({ ...both, AI_PROVIDER: " Gemini " })).toBe("gemini");
    expect(pickProvider({ ANTHROPIC_API_KEY: "a", AI_PROVIDER: "gemini" })).toBeNull();
  });
  it("falls back to whichever key exists, Gemini first", () => {
    expect(pickProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })).toBe("gemini");
    expect(pickProvider({ ANTHROPIC_API_KEY: "a" })).toBe("anthropic");
    expect(pickProvider({ GOOGLE_API_KEY: "g" })).toBe("gemini");
    expect(pickProvider({ GEMINI_API_KEY: "g", AI_PROVIDER: "something-else" })).toBe("gemini");
  });
});

describe("JSON Schema sent to Gemini", () => {
  it("is a plain object schema with every intake field required and no $schema marker", () => {
    const s = toJsonSchema(aiIntakeSchema) as { type: string; required: string[]; properties: Record<string, unknown>; $schema?: string };
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe("object");
    expect(s.required).toEqual(expect.arrayContaining(["title", "date", "food", "expenses", "openQuestions"]));
    expect(JSON.stringify(s.properties.date)).toContain("null");
    expect(JSON.stringify(s.properties.date)).toContain("YYYY-MM-DD");
  });
  it("keeps the review array limits", () => {
    const s = toJsonSchema(aiReviewSchema) as { properties: { relevantRuleIds: { maxItems: number } } };
    expect(s.properties.relevantRuleIds.maxItems).toBe(20);
  });
});
