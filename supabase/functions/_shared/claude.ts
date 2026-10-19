// Thin wrapper around the Claude API for JSON-only calls.

import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

export const MAIN_MODEL = Deno.env.get("CLAUDE_MAIN_MODEL") ?? "claude-sonnet-5-5";
export const FAST_MODEL = Deno.env.get("CLAUDE_FAST_MODEL") ?? "claude-haiku-5-5";
// Photo logging is the highest-volume call; try the fast model here if its accuracy holds up.
export const PHOTO_MODEL = Deno.env.get("CLAUDE_PHOTO_MODEL") ?? MAIN_MODEL;

// Models that accept server-side refusal fallbacks (`fallbacks: "default"`) on the Claude API.
const FALLBACK_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"];

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

export class ModelError extends Error {}

export interface JsonRequest {
  model: string;
  // Stable instructions and reference data. Cached, so keep it byte-identical between calls.
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export async function askJson<T>(req: JsonRequest): Promise<T> {
  const response = await client.beta.messages.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 16000,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.content }],
    output_config: { effort: req.effort ?? "low", format: { type: "json_schema", schema: req.schema } },
    ...(FALLBACK_MODELS.includes(req.model)
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });

  if (response.stop_reason === "refusal") {
    throw new ModelError("The model declined this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ModelError("The model ran out of output tokens before finishing.");
  }

  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  console.log(JSON.stringify({ model: response.model, usage: response.usage }));
  return JSON.parse(text) as T;
}

export function imageBlock(base64: string, mediaType: "image/jpeg" | "image/png"): Anthropic.Beta.BetaImageBlockParam {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

export function textBlock(text: string): Anthropic.Beta.BetaTextBlockParam {
  return { type: "text", text };
}
