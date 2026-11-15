import "server-only";
import { anthropicModel, runAnthropic } from "./anthropic";
import {
  AI_LIMITS,
  AiError,
  aiIntakeSchema,
  aiReviewSchema,
  aiChangeSchema,
  aiDraftSchema,
  aiFlyerSchema,
  changePrompt,
  draftPrompt,
  flyerPrompt,
  intakePrompt,
  pickProvider,
  reviewPrompt,
  type AiProvider,
  type AiIntake,
  type AiChange,
  type AiDraft,
  type AiReview,
  type AiImage,
  type ReviewRule,
  type StructuredRunner,
} from "./core";
import { geminiModel, runGemini } from "./gemini";

/**
 * Single entry point for the server-side AI features. AI_PROVIDER picks the
 * adapter ("gemini" | "anthropic"); when unset, whichever key is present wins
 * (Gemini first). With no key, every AI feature reports "not configured" and
 * the manual workflow is unaffected.
 */

export { AI_LIMITS, AiError };
export { FLYER_MIME_TYPES, type FlyerMimeType } from "./core";
export type { AiChange, AiDraft, AiIntake, AiProvider, AiReview };

export function aiProvider(): AiProvider | null {
  return pickProvider(process.env);
}

export const aiConfigured = () => aiProvider() !== null;

/** Human label for setup/status screens, e.g. "Google Gemini (gemini-3.5-flash-lite)". */
export function aiProviderLabel(): string | null {
  const p = aiProvider();
  if (p === "gemini") return `Google Gemini (${geminiModel()})`;
  if (p === "anthropic") return `Anthropic Claude (${anthropicModel()})`;
  return null;
}

function runner(): StructuredRunner {
  const p = aiProvider();
  if (p === "gemini") return runGemini;
  if (p === "anthropic") return runAnthropic;
  throw new AiError("not_configured", "AI is not configured on this server.");
}

export async function extractIntake(description: string, today: string): Promise<AiIntake> {
  if (description.length > AI_LIMITS.maxInputChars) {
    throw new AiError("input_too_large", `Descriptions are limited to ${AI_LIMITS.maxInputChars} characters.`);
  }
  const { system, user } = intakePrompt(description, today);
  return runner()(aiIntakeSchema, system, user);
}

/**
 * Two calls: the vision model transcribes the flyer into plain sentences, then the
 * normal intake extraction runs on that text, so flyer and typed descriptions share
 * one validated path. Returns null when the image isn't a readable flyer.
 */
export async function readFlyer(image: AiImage, today: string): Promise<{ transcript: string; intake: AiIntake } | null> {
  const { system, user } = flyerPrompt(today);
  const flyer = await runner()(aiFlyerSchema, system, user, image);
  const transcript = flyer.description.trim();
  if (!flyer.readable || transcript.length < 10) return null;
  return { transcript, intake: await extractIntake(transcript.slice(0, AI_LIMITS.maxInputChars), today) };
}

export async function reviewPlan(planSummary: string, rules: ReviewRule[]): Promise<AiReview> {
  const { system, user } = reviewPrompt(planSummary, rules);
  return runner()(aiReviewSchema, system, user);
}

export async function interpretChange(message: string, currentPlan: string, today: string): Promise<AiChange> {
  if (message.length > 1000) throw new AiError("input_too_large", "Change messages are limited to 1,000 characters.");
  const { system, user } = changePrompt(message, currentPlan, today);
  return runner()(aiChangeSchema, system, user);
}

export async function writeDraft(purpose: string, facts: string, template: string): Promise<AiDraft> {
  const { system, user } = draftPrompt(purpose, facts, template);
  return runner()(aiDraftSchema, system, user);
}
