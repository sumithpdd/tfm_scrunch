/**
 * Token counts returned by the AI SDK after a model generate. Provider-agnostic: the Vercel
 * AI SDK normalizes usage the same way for Azure OpenAI and Gemini, so this parsing logic
 * works unmodified whichever one AI_PROVIDER currently selects (see gemini-config.ts).
 */

export type GeminiTokenUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Azure gpt-4o list rates by default unless GEMINI_*_USD_PER_MILLION is set. */
  estimatedUsd: number;
};

/**
 * Default cost estimate assumes the Azure gpt-4o deployment ($2.50 / $10 per 1M tokens as of
 * Nov 2026 -- notably pricier than gpt-4o-mini, so these are NOT mini rates). Override via
 * GEMINI_INPUT_USD_PER_MILLION / GEMINI_OUTPUT_USD_PER_MILLION if your deployment or active
 * provider differs (e.g. back on Gemini, or a gpt-4o-mini deployment).
 */
const DEFAULT_INPUT_USD_PER_M = 2.5;
const DEFAULT_OUTPUT_USD_PER_M = 10;

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function estimateGeminiUsd(inputTokens: number, outputTokens: number): number {
  const inputRate = Number(process.env.GEMINI_INPUT_USD_PER_MILLION) || DEFAULT_INPUT_USD_PER_M;
  const outputRate = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION) || DEFAULT_OUTPUT_USD_PER_M;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

export function usageFromAiResult(
  result: { usage?: unknown } | null | undefined,
  model: string,
): GeminiTokenUsage | null {
  const raw = result?.usage;
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const inputTokens = asInt(data.inputTokens ?? data.promptTokens ?? data.input);
  const outputTokens = asInt(data.outputTokens ?? data.completionTokens ?? data.output);
  const totalTokens = asInt(data.totalTokens) || inputTokens + outputTokens;
  if (inputTokens <= 0 && outputTokens <= 0 && totalTokens <= 0) return null;
  return {
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedUsd: estimateGeminiUsd(inputTokens, outputTokens),
  };
}

export function addGeminiUsage(
  a: GeminiTokenUsage | null | undefined,
  b: GeminiTokenUsage | null | undefined,
): GeminiTokenUsage | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const inputTokens = a.inputTokens + b.inputTokens;
  const outputTokens = a.outputTokens + b.outputTokens;
  return {
    model: a.model || b.model,
    inputTokens,
    outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedUsd: estimateGeminiUsd(inputTokens, outputTokens),
  };
}

export function parseGeminiUsage(value: unknown): GeminiTokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const inputTokens = asInt(data.inputTokens);
  const outputTokens = asInt(data.outputTokens);
  const totalTokens = asInt(data.totalTokens) || inputTokens + outputTokens;
  if (inputTokens <= 0 && outputTokens <= 0 && totalTokens <= 0) return null;
  return {
    model: String(data.model ?? "").trim() || "gemini",
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedUsd:
      typeof data.estimatedUsd === "number" && Number.isFinite(data.estimatedUsd)
        ? data.estimatedUsd
        : estimateGeminiUsd(inputTokens, outputTokens),
  };
}

export function formatUsd(amount: number): string {
  if (amount <= 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatGeminiUsage(usage: GeminiTokenUsage): string {
  return `${usage.totalTokens.toLocaleString()} tokens · ${usage.inputTokens.toLocaleString()} in · ${usage.outputTokens.toLocaleString()} out · est. ${formatUsd(usage.estimatedUsd)}`;
}
