import "server-only";
import { generateObject, generateText } from "ai";
import { getModelFor, formatGeminiError, describeGenerationError } from "@/lib/gemini-config";
import { modelIdFor, type AiProviderName } from "@/lib/ai-settings";
import { getRuntimeAiSettings } from "@/server/ai/runtime-settings";
import { addGeminiUsage, usageFromAiResult, type GeminiTokenUsage } from "@/lib/gemini-usage";
import type { AeoAuditReport } from "@/lib/audit-types";
import { emptyAuditReport } from "@/lib/audit-types";
import {
  AUDIT_SYSTEM_PROMPT,
  auditReportSchema,
  type AeoAuditGenerated,
} from "@/server/audit/prompts/audit-brief";
import { fetchPublicPageText } from "@/server/audit/fetch-public-page";


function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

function withInputIdentity(value: unknown, input: GenerateAuditInput): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const data = value as Record<string, unknown>;
  const brandName = typeof data.brandName === "string" ? data.brandName.trim() : "";
  const website = typeof data.website === "string" ? data.website.trim() : "";
  return {
    ...data,
    brandName: brandName || input.brandName,
    website: website || input.website,
  };
}

function normalizeReport(
  generated: AeoAuditGenerated,
  input: GenerateAuditInput,
  provider: AiProviderName,
): AeoAuditReport {
  const prompts = (generated.prompts ?? []).map((p) => ({ ...p }));
  const competitors = generated.competitors ?? [];
  const personas = generated.personas ?? [];
  const topics = generated.topics ?? [];
  const nonBranded = prompts.filter((p) => !p.branded).length;
  return {
    brandName: generated.brandName?.trim() || input.brandName,
    website: generated.website?.trim() || input.website,
    primaryCountry: generated.primaryCountry,
    primaryCountryLabel: generated.primaryCountryLabel,
    description: generated.description,
    readiness: generated.readiness,
    readinessSummary: generated.readinessSummary,
    competitors,
    personas,
    topics,
    prompts,
    hypotheses: generated.hypotheses ?? [],
    citationPrompts: generated.citationPrompts ?? [],
    mentionRates: [...(generated.mentionRates ?? [])].sort((a, b) => b.estimatedPct - a.estimatedPct),
    visibility: generated.visibility ?? null,
    counts: {
      topics: topics.length,
      competitors: competitors.length,
      personas: personas.length,
      prompts: prompts.length,
      nonBrandedPct: prompts.length ? Math.round((nonBranded / prompts.length) * 100) : 0,
      platforms: 9,
    },
    source: provider === "gemini" ? "gemini" : "azure-openai",
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

  let provider: AiProviderName = "azure";
  try {
    const settings = await getRuntimeAiSettings();
    provider = settings.provider;
    const model = getModelFor(settings);
    const modelId = modelIdFor(settings);
    notify?.({
      id: "research",
      label: "Researching how AI would describe you",
      detail: `Using ${modelId}`,
    });
    let generated: AeoAuditGenerated;
    let usage: GeminiTokenUsage | null = null;
    let objectError: unknown = null;
    try {
      const result = await generateObject({
        model,
        schema: auditReportSchema,
        system: AUDIT_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      generated = result.object;
      usage = usageFromAiResult(result, modelId);
    } catch (err) {
      objectError = err;
      try {
        const textResult = await generateText({
          model,
          system: `${AUDIT_SYSTEM_PROMPT}\nReturn a single JSON object matching the audit report fields. No markdown.`,
          prompt: userPrompt,
        });
        generated = auditReportSchema.parse(
          withInputIdentity(parseJsonLoose(textResult.text ?? ""), input),
        );
        usage = addGeminiUsage(usage, usageFromAiResult(textResult, modelId));
      } catch (fallbackErr) {
        const primary = describeGenerationError(objectError);
        const secondary = describeGenerationError(fallbackErr);
        // Both the structured call and the text-fallback parse failed -- surface the real first
        // cause instead of letting the fallback's zod parse error (usually a confusing raw issues
        // dump) mask it.
        throw new Error(`Structured output failed (${primary}); text fallback also failed (${secondary})`);
      }
    }

    notify?.({ id: "compare", label: "Comparing you with brands AI names nearby" });
    notify?.({ id: "write", label: "Writing your visibility brief" });
    return { report: { ...normalizeReport(generated, input, provider), ...(usage ? { usage } : {}) } };
  } catch (err: unknown) {
    return {
      report: emptyAuditReport(input.brandName, input.website),
      error: formatGeminiError(err, provider),
    };
  }
}
