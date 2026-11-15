import "server-only";
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { z } from "zod";
import { AI_LIMITS, AiError, toJsonSchema, type AiImage } from "./core";

/**
 * Google Gemini adapter (AI_PROVIDER=gemini). Default model gemini-3.5-flash-lite.
 *
 * Key: GEMINI_API_KEY (Google AI Studio). GEMINI_BASE_URL / GEMINI_API_VERSION
 * are optional overrides for an API-compatible proxy.
 * Output is constrained with a JSON Schema generated from the
 * same Zod schema, then re-validated here — the model's JSON is never trusted.
 */

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
export const geminiConfigured = () => !!apiKey();
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!geminiConfigured()) throw new AiError("not_configured", "AI is not configured on this server.");
  const baseUrl = process.env.GEMINI_BASE_URL || undefined;
  const apiVersion = process.env.GEMINI_API_VERSION ?? undefined;
  client ??= new GoogleGenAI({
    apiKey: apiKey(),
    httpOptions: {
      timeout: AI_LIMITS.timeoutMs,
      // One quick retry for transient 429/5xx (e.g. 503 "overloaded"), like the Claude adapter's maxRetries: 1.
      retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 2 },
      ...(baseUrl ? { baseUrl } : {}), ...(apiVersion !== undefined ? { apiVersion } : {}) },
  });
  return client;
}

const BLOCKED: string[] = [FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.RECITATION];

export async function runGemini<T>(schema: z.ZodType<T>, system: string, user: string, image?: AiImage): Promise<T> {
  const ai = getClient();
  try {
    const res = await ai.models.generateContent({
      model: geminiModel(),
      contents: image ? [{ role: "user", parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: user }] }] : user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(schema),
        maxOutputTokens: AI_LIMITS.maxOutputTokens,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        automaticContinuation: false,
      },
    });
    if (res.promptFeedback?.blockReason) throw new AiError("refused", "The AI model declined this request. Continue manually.");
    const finish = res.candidates?.[0]?.finishReason;
    if (finish && BLOCKED.includes(finish)) throw new AiError("refused", "The AI model declined this request. Continue manually.");
    if (finish === FinishReason.MAX_TOKENS) throw new AiError("invalid_output", "The AI response was cut off. Try again or continue manually.");
    const text = res.text;
    if (!text) throw new AiError("invalid_output", "The AI returned an empty response. Nothing was applied.");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError("invalid_output", "The AI returned data that was not valid JSON. Nothing was applied.");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new AiError("invalid_output", "The AI returned data that failed validation. Nothing was applied.");
    return parsed.data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof ApiError) {
      if (e.status === 429) throw new AiError("rate_limited", "The AI service is busy or the free quota is used up. Try again in a minute.");
      if (e.status === 401 || e.status === 403) throw new AiError("not_configured", "The AI credentials were rejected by the provider.");
      if (e.status === 408 || e.status === 504) throw new AiError("timeout", "The AI request timed out. Your work is unchanged.");
      if (e.status === 503) throw new AiError("upstream", "The AI service is temporarily overloaded. Try again in a moment, or continue manually.");
      throw new AiError("upstream", `The AI service returned an error (${e.status}).`);
    }
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError" || /timed? ?out/i.test(e.message))) {
      throw new AiError("timeout", "The AI request timed out. Your work is unchanged.");
    }
    throw new AiError("upstream", "The AI request failed. Your work is unchanged.");
  }
}
