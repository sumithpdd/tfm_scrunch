import "server-only";
import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getGeminiModelId, formatGeminiError } from "@/lib/gemini-config";
import { addGeminiUsage, usageFromAiResult, type GeminiTokenUsage } from "@/lib/gemini-usage";
import {
  SCRUNCH_PLATFORM_TOKENS,
  type ScrunchBrandSetupDoc,
  type ScrunchCounts,
  type ScrunchPromptRow,
} from "@/lib/scrunch-setup-types";
import {
  SCRUNCH_SETUP_SYSTEM,
  scrunchSheetSchema,
  type ScrunchSheetGenerated,
} from "@/server/scrunch/prompts/brand-setup";
import { fetchPublicPageText } from "@/server/audit/fetch-public-page";
import { DEFAULT_SCRUNCH_SUCCESS_MEASURES } from "@/lib/scrunch-blank-intake";

let providerSingleton: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getProvider() {
  if (!providerSingleton) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    providerSingleton = createGoogleGenerativeAI({ apiKey });
  }
  return providerSingleton;
}

export type GenerateScrunchInput = {
  setupId: string;
  brandName: string;
  website: string;
  intakeNotes: string;
  geographicScope: string;
  relationship: ScrunchBrandSetupDoc["relationship"];
  stakeholders: ScrunchBrandSetupDoc["stakeholders"];
  successMeasures: string[];
  createdByUid?: string;
  regenerate?: boolean;
  lockedPrimaryCountry?: string;
  previousSummary?: string;
  scrunchOrgId?: string;
  scrunchBrandId?: string;
};

function recomputeCounts(prompts: ScrunchPromptRow[], topicCount: number, competitorCount: number, personaCount: number): ScrunchCounts {
  const seeds = prompts.length;
  const nonBrandedCount = prompts.filter((p) => !p.branded && p.tags !== "brand-adjacent").length;
  const nonBrandedPct = seeds ? Math.round((nonBrandedCount / seeds) * 100) : 0;
  return {
    topics: topicCount,
    competitors: competitorCount,
    personas: personaCount,
    seeds,
    nonBrandedCount,
    nonBrandedPct,
    platforms: 9,
    variantsEstimate: seeds * 9,
  };
}

function normalizeSheet(
  generated: ScrunchSheetGenerated,
  input: GenerateScrunchInput,
): Omit<ScrunchBrandSetupDoc, "updatedAt"> {
  const prompts: ScrunchPromptRow[] = generated.prompts.map((p) => ({
    ...p,
    platforms: SCRUNCH_PLATFORM_TOKENS,
    geos: generated.primaryCountry || p.geos,
    languages: generated.defaultLanguage || p.languages,
  }));

  return {
    setupId: input.setupId,
    brandName: generated.brandName || input.brandName,
    website: generated.website || input.website,
    relationship: input.relationship,
    primaryCountry:
      input.regenerate && input.lockedPrimaryCountry
        ? input.lockedPrimaryCountry
        : generated.primaryCountry,
    primaryCountryLabel: countryLabel(
      input.regenerate && input.lockedPrimaryCountry
        ? input.lockedPrimaryCountry
        : generated.primaryCountry,
    ),
    defaultLanguage: generated.defaultLanguage,
    caseSensitive: generated.caseSensitive,
    description: generated.description,
    alternativeNames: generated.alternativeNames,
    alternativeWebsites: generated.alternativeWebsites,
    competitors: generated.competitors,
    removedCompetitors: generated.removedCompetitors,
    subBrands: generated.subBrands,
    personas: generated.personas,
    topics: generated.topics,
    prompts,
    counts: recomputeCounts(
      prompts,
      generated.topics.length,
      generated.competitors.length,
      generated.personas.length,
    ),
    hypotheses: generated.hypotheses,
    openQuestions: generated.openQuestions,
    briefMarkdown: generated.briefMarkdown,
    scopeDecision: generated.scopeDecision,
    wizardHandoff: generated.wizardHandoff,
    biasNotes: generated.biasNotes,
    intakeNotes: generated.briefMarkdown || input.intakeNotes,
    stakeholders: input.stakeholders,
    successMeasures: input.successMeasures,
    geographicScope: countryLabel(
      input.regenerate && input.lockedPrimaryCountry
        ? input.lockedPrimaryCountry
        : generated.primaryCountry,
    ),
    status: "PLANNED",
    scrunchOrgId: input.scrunchOrgId || "",
    scrunchBrandId: input.scrunchBrandId || "",
    createdByUid: input.createdByUid || "",
    createdByEmail: input.createdByUid || "",
    source: "gemini",
    skillSourceUrl: "https://github.com/rjzflynnbx/scrunch-brand-setup-v1",
  };
}

function countryLabel(code: string): string {
  const c = code.trim().toUpperCase();
  const map: Record<string, string> = {
    GB: "United Kingdom",
    UK: "United Kingdom",
    US: "United States",
    IE: "Ireland",
    AU: "Australia",
    NZ: "New Zealand",
    CA: "Canada",
    DE: "Germany",
    FR: "France",
    NL: "Netherlands",
    ES: "Spain",
    IT: "Italy",
    SE: "Sweden",
    CH: "Switzerland",
    SG: "Singapore",
    IN: "India",
    AE: "United Arab Emirates",
  };
  return map[c] ?? code;
}

function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function generateScrunchSetup(
  input: GenerateScrunchInput,
): Promise<{ doc: ScrunchBrandSetupDoc; error?: string }> {
  const page = await fetchPublicPageText(input.website);
  const measures =
    input.successMeasures.filter(Boolean).length > 0
      ? input.successMeasures
      : DEFAULT_SCRUNCH_SUCCESS_MEASURES;

  const userPrompt = `Follow scrunch-brand-setup-v1. ${input.regenerate ? "Mode: REGENERATE / enrich an existing planned brand." : "Mode: GENERATE a new planned brand."}

The human only supplied brand name and website. You must research everything else.

Brand name: ${input.brandName}
Primary website: ${input.website}
${input.lockedPrimaryCountry ? `Locked primary country: ${input.lockedPrimaryCountry}` : ""}

Infer from the site and public knowledge:
- primary market / ISO-2 country (not US unless the brand is US-primary)
- 2–4 sentence brand description for the Scrunch wizard
- audiences, products/services, typical buyer questions
- competitors with real domains
- topics and 36–42 prompt seeds
- §0 brief (this is the recon / extra notes — do not ask the human for notes)

${input.previousSummary ? `## Previous build sheet (update from this)\n${input.previousSummary}\n` : ""}
## Fetched homepage text${page.warning ? ` (${page.warning})` : ""}${page.fetchedUrl ? ` from ${page.fetchedUrl}` : ""}
${page.text || "(empty — use public knowledge; note gaps in openQuestions)"}

Do not invent owned domains or stakeholder emails.`;

  try {
    const provider = getProvider();
    const model = provider(getGeminiModelId());

    const modelId = getGeminiModelId();
    let generated: ScrunchSheetGenerated;
    let usage: GeminiTokenUsage | null = null;
    try {
      const result = await generateObject({
        model,
        schema: scrunchSheetSchema,
        system: SCRUNCH_SETUP_SYSTEM,
        prompt: userPrompt,
      });
      generated = result.object;
      usage = usageFromAiResult(result, modelId);
    } catch {
      const textResult = await generateText({
        model,
        system: `${SCRUNCH_SETUP_SYSTEM}\nReturn a single JSON object matching the build sheet fields. No markdown.`,
        prompt: userPrompt,
      });
      generated = scrunchSheetSchema.parse(parseJsonLoose(textResult.text ?? ""));
      usage = addGeminiUsage(usage, usageFromAiResult(textResult, modelId));
    }

    return {
      doc: {
        ...normalizeSheet(generated, { ...input, successMeasures: measures }),
        ...(usage ? { geminiUsage: usage } : {}),
      },
    };
  } catch (err: unknown) {
    return {
      doc: {
        setupId: input.setupId,
        brandName: input.brandName,
        website: input.website,
        relationship: input.relationship,
        primaryCountry: "",
        primaryCountryLabel: "",
        defaultLanguage: "en",
        caseSensitive: false,
        description: "",
        alternativeNames: [],
        alternativeWebsites: [],
        competitors: [],
        removedCompetitors: [],
        subBrands: [],
        personas: [],
        topics: [],
        prompts: [],
        counts: {
          topics: 0,
          competitors: 0,
          personas: 0,
          seeds: 0,
          nonBrandedCount: 0,
          nonBrandedPct: 0,
          platforms: 9,
          variantsEstimate: 0,
        },
        hypotheses: [],
        openQuestions: [],
        briefMarkdown: "",
        scopeDecision: "",
        wizardHandoff: "",
        biasNotes: "",
        intakeNotes: input.intakeNotes,
        stakeholders: input.stakeholders,
        successMeasures: input.successMeasures,
        geographicScope: input.geographicScope,
        status: "INTAKE",
        scrunchOrgId: input.scrunchOrgId || "",
        scrunchBrandId: input.scrunchBrandId || "",
        createdByUid: input.createdByUid || "",
        createdByEmail: input.createdByUid || "",
        source: "intake",
        skillSourceUrl: "https://github.com/rjzflynnbx/scrunch-brand-setup-v1",
      },
      error: formatGeminiError(err),
    };
  }
}
