import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AI_LIMITS, AiError, type AiImage } from "./core";

/** Anthropic Claude adapter (AI_PROVIDER=anthropic). */

export const anthropicConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const anthropicModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicConfigured()) throw new AiError("not_configured", "AI is not configured on this server.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: AI_LIMITS.timeoutMs, maxRetries: 1 });
  return client;
}

export async function runAnthropic<T>(schema: z.ZodType<T>, system: string, user: string, image?: AiImage): Promise<T> {
  const c = getClient();
  try {
    const res = await c.beta.messages.parse({
      model: anthropicModel(),
      max_tokens: AI_LIMITS.maxOutputTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [
        {
          role: "user",
          content: image
            ? [
                { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
                { type: "text", text: user },
              ]
            : user,
        },
      ],
      output_config: { format: betaZodOutputFormat(schema), effort: "low" },
    });
    if (res.stop_reason === "refusal") throw new AiError("refused", "The AI model declined this request. Continue manually.");
    if (res.stop_reason === "max_tokens") throw new AiError("invalid_output", "The AI response was cut off. Try again or continue manually.");
    const parsed = schema.safeParse(res.parsed_output);
    if (!parsed.success) throw new AiError("invalid_output", "The AI returned data that failed validation. Nothing was applied.");
    return parsed.data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("timeout", "The AI request timed out. Your work is unchanged.");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI service is busy. Try again in a minute.");
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("not_configured", "The AI credentials were rejected by the provider.");
    if (e instanceof Anthropic.APIError) throw new AiError("upstream", `The AI service returned an error (${e.status ?? "network"}).`);
    throw new AiError("upstream", "The AI request failed. Your work is unchanged.");
  }
}
