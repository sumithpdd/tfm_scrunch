/** Gemini model for CMS chat — override via GEMINI_MODEL in .env.local */
export function getGeminiModelId(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes("quota") || raw.includes("Quota exceeded") || raw.includes("429")) {
    return (
      "Gemini API quota exceeded for the current model/plan. " +
      "Try setting GEMINI_MODEL=gemini-2.0-flash-lite or gemini-2.5-flash in .env.local, " +
      "enable billing at https://ai.google.dev/, or wait a minute and retry. " +
      "Usage: https://ai.dev/rate-limit"
    );
  }

  if (raw.includes("GEMINI_API_KEY") || raw.includes("API key")) {
    return "GEMINI_API_KEY is missing or invalid. Add it to .env.local and restart the dev server.";
  }

  return raw;
}
