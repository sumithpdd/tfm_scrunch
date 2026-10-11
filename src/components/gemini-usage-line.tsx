import { formatGeminiUsage, type GeminiTokenUsage } from "@/lib/gemini-usage";

export function GeminiUsageLine({
  usage,
  label = "Gemini",
}: {
  usage?: GeminiTokenUsage | null;
  label?: string;
}) {
  if (!usage) return null;
  return (
    <p className="text-xs leading-5 text-zinc-500">
      <span className="font-semibold text-zinc-600">{label}</span>
      {" · "}
      {formatGeminiUsage(usage)}
      {usage.model ? <span className="text-zinc-400"> · {usage.model}</span> : null}
    </p>
  );
}
