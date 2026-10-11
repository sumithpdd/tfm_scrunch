import "server-only";
import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getGeminiModelId, formatGeminiError } from "@/lib/gemini-config";
import { addGeminiUsage, usageFromAiResult, type GeminiTokenUsage } from "@/lib/gemini-usage";
import type { AeoAuditReport } from "@/lib/audit-types";
import { emptyAuditReport } from "@/lib/audit-types";
import {
  AUDIT_SYSTEM_PROMPT,
  auditReportSchema,
  type AeoAuditGenerated,
} from "@/server/audit/prompts/audit-brief";
import { fetchPublicPageText } from "@/server/audit/fetch-public-page";

let providerSingleton: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getProvider() {
  if (!providerSingleton) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    providerSingleton = createGoogleGenerativeAI({ apiKey });
  }
  return providerSingleton;
}

function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeReport(generated: AeoAuditGenerated): AeoAuditReport {
  const prompts = generated.prompts.map((p) => ({ ...p }));
  const nonBranded = prompts.filter((p) => !p.branded).length;
  return {
    brandName: generated.brandName,
    website: generated.website,
    primaryCountry: generated.primaryCountry,
    primaryCountryLabel: generated.primaryCountryLabel,
    description: generated.description,
    readiness: generated.readiness,
    readinessSummary: generated.readinessSummary,
    competitors: generated.competitors,
    personas: generated.personas,
    topics: generated.topics,
    prompts,
    hypotheses: generated.hypotheses,
    citationPrompts: generated.citationPrompts ?? [],
    mentionRates: [...(generated.mentionRates ?? [])].sort((a, b) => b.estimatedPct - a.estimatedPct),
    visibility: generated.visibility ?? null,
    counts: {
      topics: generated.topics.length,
      competitors: generated.competitors.length,
      personas: generated.personas.length,
      prompts: prompts.length,
      nonBrandedPct: prompts.length ? Math.round((nonBranded / prompts.length) * 100) : 0,
      platforms: 9,
    },
    source: "gemini",
  };
}

export type GenerateAuditInput = {
  brandName: string;
  website: string;
  extraUrls?: string[];
  onProgress?: (event: { id: string; label: string; detail?: string }) => void;
};

export async function generateAeoAudit(
  input: GenerateAuditInput,
): Promise<{ report: AeoAuditReport; error?: string }> {
  const notify = input.onProgress;
  notify?.({ id: "read_site", label: "Reading your homepage", detail: input.website });
  const page = await fetchPublicPageText(input.website);

  const extraPages: { url: string; text: string; warning?: string }[] = [];
  for (const extra of input.extraUrls ?? []) {
    notify?.({ id: "read_extra", label: "Reading extra pages you added", detail: extra });
    const fetched = await fetchPublicPageText(extra);
    extraPages.push({ url: fetched.fetchedUrl || extra, text: fetched.text, warning: fetched.warning });
  }

  const extraBlock = extraPages.length
    ? extraPages
        .map(
          (item, i) =>
            `\n## Extra page ${i + 1}${item.warning ? ` (${item.warning})` : ""} from ${item.url}\n${item.text || "(empty)"}`,
        )
        .join("")
    : "";

  const userPrompt = `Run the free AEO/GEO audit for this brand.

Brand name: ${input.brandName}
Primary website: ${input.website}

## Fetched homepage text${page.warning ? ` (${page.warning})` : ""}${page.fetchedUrl ? ` from ${page.fetchedUrl}` : ""}
${page.text || "(empty - use public knowledge; note this clearly in readinessSummary)"}
${extraBlock}
`;

  try {
    const provider = getProvider();
    const model = provider(getGeminiModelId());

    const modelId = getGeminiModelId();
    notify?.({
      id: "research",
      label: "Researching how AI would describe you",
      detail: `Using ${modelId}`,
    });
    let generated: AeoAuditGenerated;
    let usage: GeminiTokenUsage | null = null;
    try {
      const result = await generateObject({
        model,
        schema: auditReportSchema,
        system: AUDIT_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      generated = result.object;
      usage = usageFromAiResult(result, modelId);
    } catch {
      const textResult = await generateText({
        model,
        system: `${AUDIT_SYSTEM_PROMPT}\nReturn a single JSON object matching the audit report fields. No markdown.`,
        prompt: userPrompt,
      });
      generated = auditReportSchema.parse(parseJsonLoose(textResult.text ?? ""));
      usage = addGeminiUsage(usage, usageFromAiResult(textResult, modelId));
    }

    notify?.({ id: "compare", label: "Comparing you with brands AI names nearby" });
    notify?.({ id: "write", label: "Writing your visibility brief" });
    return { report: { ...normalizeReport(generated), ...(usage ? { usage } : {}) } };
  } catch (err: unknown) {
    return {
      report: emptyAuditReport(input.brandName, input.website),
      error: formatGeminiError(err),
    };
  }
}
