import "server-only";
import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getGeminiModelId, formatGeminiError } from "@/lib/gemini-config";
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
};

export async function generateAeoAudit(
  input: GenerateAuditInput,
): Promise<{ report: AeoAuditReport; error?: string }> {
  const page = await fetchPublicPageText(input.website);

  const userPrompt = `Run the free AEO/GEO audit for this brand.

Brand name: ${input.brandName}
Primary website: ${input.website}

## Fetched homepage text${page.warning ? ` (${page.warning})` : ""}${page.fetchedUrl ? ` from ${page.fetchedUrl}` : ""}
${page.text || "(empty - use public knowledge; note this clearly in readinessSummary)"}
`;

  try {
    const provider = getProvider();
    const model = provider(getGeminiModelId());

    let generated: AeoAuditGenerated;
    try {
      const result = await generateObject({
        model,
        schema: auditReportSchema,
        system: AUDIT_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      generated = result.object;
    } catch {
      const textResult = await generateText({
        model,
        system: `${AUDIT_SYSTEM_PROMPT}\nReturn a single JSON object matching the audit report fields. No markdown.`,
        prompt: userPrompt,
      });
      generated = auditReportSchema.parse(parseJsonLoose(textResult.text ?? ""));
    }

    return { report: normalizeReport(generated) };
  } catch (err: unknown) {
    return {
      report: emptyAuditReport(input.brandName, input.website),
      error: formatGeminiError(err),
    };
  }
}
