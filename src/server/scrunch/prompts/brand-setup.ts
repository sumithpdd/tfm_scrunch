import { z } from "zod";
import { SCRUNCH_PLATFORM_TOKENS } from "@/lib/scrunch-setup-types";

export const scrunchSheetSchema = z.object({
  brandName: z.string(),
  website: z.string(),
  primaryCountry: z.string().describe("ISO-2, e.g. GB. Never US unless the brand is US-primary."),
  defaultLanguage: z.string().describe("ISO language, e.g. en"),
  caseSensitive: z.boolean(),
  description: z
    .string()
    .describe("2–4 sentences for the Scrunch wizard Brand details field. Replace auto-generated copy."),
  alternativeNames: z.array(z.object({ name: z.string(), why: z.string() })),
  alternativeWebsites: z.array(
    z.object({
      url: z.string(),
      ownership: z.string().describe("How ownership was confirmed — omit if not owned"),
    }),
  ),
  competitors: z.array(
    z.object({
      name: z.string(),
      altNames: z.string(),
      website: z.string(),
      whyInScope: z.string().describe("Cite prompt row numbers that need this competitor"),
    }),
  ),
  removedCompetitors: z.array(z.object({ name: z.string(), why: z.string() })),
  subBrands: z.array(
    z.object({ name: z.string(), websites: z.string(), altNames: z.string() }),
  ),
  personas: z.array(z.object({ name: z.string(), description: z.string() })),
  topics: z.array(
    z.object({
      name: z.string().describe("No commas in names"),
      description: z.string(),
    }),
  ),
  prompts: z.array(
    z.object({
      prompt: z.string().describe("Natural buyer question as typed into ChatGPT"),
      personas: z.string().describe("Exact persona name from the personas list"),
      geos: z.string().describe("ISO-2 matching primary country, e.g. GB"),
      languages: z.string(),
      platforms: z.string(),
      topics: z.string().describe("Exact topic name, no commas"),
      tags: z.string().describe("true-nonbranded or brand-adjacent"),
      stage: z.enum(["Awareness", "Consideration", "Conversion", "Loyalty", "Other"]),
      branded: z.boolean(),
    }),
  ),
  hypotheses: z.array(
    z.object({
      expect: z.string(),
      because: z.string(),
      confirmedBy: z.string(),
      refutedBy: z.string(),
    }),
  ),
  openQuestions: z.array(
    z.object({
      question: z.string(),
      blocks: z.string(),
      howToSettle: z.string(),
    }),
  ),
  briefMarkdown: z.string().describe("§0 brief, 1–2 pages equivalent, plain language"),
  scopeDecision: z.string(),
  wizardHandoff: z.string().describe("Click-order walkthrough with every value filled in"),
  biasNotes: z.string().describe("Self-attack: clustering, branded-in-substance, US default, unowned domains"),
});

export type ScrunchSheetGenerated = z.infer<typeof scrunchSheetSchema>;

export const SCRUNCH_SETUP_SYSTEM = `You are executing the Scrunch brand-setup skill (https://github.com/rjzflynnbx/scrunch-brand-setup-v1) for a Sitecore / AEO demo.

Scope: PLAN only. Do not claim you created anything in Scrunch. Output a complete build sheet as structured JSON.

This works for ANY brand. Inputs are brand name, website, optional notes, and (when available) fetched homepage text. You must research: who they are, audiences, products/services, typical questions, real competitors, and one primary market.

## Method
1. Recon: prefer fetched homepage language (support/FAQ/nav), then well-known public facts. Do not invent owned domains, emails, or products not evidenced. If the fetch is empty, still produce a credible sheet from public knowledge and list uncertainties in openQuestions.
2. Scope (demo defaults unless notes override): 6–8 topics, ~10 competitors (min 6), 4–6 personas, 36–42 prompt seeds, ~70–80% non-branded, ALL 9 platforms, ONE primary market. Cut topics before cutting prompts so density stays ≥ ~5 prompts per topic.
3. Entities then prompts. Hallucinated owned domains are the highest-cost error — when in doubt omit alternative websites.
4. Bias check yourself: clustering, branded-in-substance non-branded prompts, wizard US default, competitor set not scoped to prompts, missing loss prompts.

## Hard rules
- Infer primary country from the site (ccTLD, addresses, “UK/US/EU” copy). ISO-2 e.g. GB, US, IE, AU, DE. Wizard defaults to United States — never leave US unless the brand is actually US-primary.
- Do not assume United Kingdom unless evidence supports it.
- **Regenerate / enrich:** if a previous sheet is provided, this is not greenfield. Keep the locked primary country unless notes explicitly change market. Rebuild topics/competitors/prompts; skip claiming the creation wizard was run. New topics have no confirmed path in live Scrunch outside the wizard — note that in openQuestions.
- Alternative websites = owned domains only. Never Wikipedia, news, app-store listings, or competitor sites.
- Competitor websites must be real homepages. Alt names comma-separated, no stray commas in topic/persona names.
- Prompt text: full natural questions in the market language (FAQ/support vocabulary, not marketing slogans). Country on every prompt (Geos). Platforms always exactly: ${SCRUNCH_PLATFORM_TOKENS}
- Spread prompts across each topic (no clustering). Cut topics before cutting prompts. Density ≥ ~5 prompts per topic.
- Stage uses Funnel names: Awareness, Consideration, Conversion, Loyalty, Other. Skew early but no empty stage.
- Tags: true-nonbranded vs brand-adjacent (sub-brand names count as branded for the ratio even if Scrunch's flag would miss them).
- Include prompts the brand will probably lose — a clean sweep is not credible.
- Personas: geo_country stays unset (empty). Distinct buying motions only. If two personas would produce the same data slice, they are one persona.
- Sub-brands only if product names carry equity in prompts; otherwise empty array.
- Counts in narrative must match the prompt array (recompute seeds, non-branded %, prompts per topic).
- Hypotheses: each names a metric, a rough threshold, and what would refute it.
- Wizard handoff: Website → Brand details (paste description, SET primary country) → Personas → Competitors (domains) → Topics → Review. Then exit prompt-generation wizard via Prompt Templates. CSV import: Prompt Templates → New → Import prompts. Warn that CSV Geos may not persist — country rests on brand primary.

This app implements skill steps 0–4 (recon, scope, sheet, bias). Steps 5–6 are always human in Scrunch. Do not invent MCP writes.`;
