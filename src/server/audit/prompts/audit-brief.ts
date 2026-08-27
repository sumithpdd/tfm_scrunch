import { z } from "zod";
import { AEO_PLATFORM_TOKENS } from "@/lib/audit-types";

export const auditReportSchema = z.object({
  brandName: z.string(),
  website: z.string(),
  primaryCountry: z.string().describe("ISO-2, e.g. GB. Never US unless the brand is US-primary."),
  primaryCountryLabel: z.string().describe("Human label, e.g. United Kingdom"),
  description: z.string().describe("2-4 sentences describing what the brand does, for a non-expert reader."),
  readiness: z
    .enum(["Strong", "Developing", "At risk"])
    .describe("Overall qualitative read on AI/AEO discoverability today - be honest, most brands are 'Developing'."),
  readinessSummary: z
    .string()
    .describe("2-3 plain-language sentences explaining the readiness rating - cite specific gaps or strengths."),
  competitors: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
      whyInScope: z.string().describe("Why an AI assistant would mention this competitor alongside the brand"),
    }),
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
      prompt: z.string().describe("A natural buyer question exactly as someone would type it into ChatGPT or Perplexity"),
      persona: z.string().describe("Exact persona name from the personas list"),
      topic: z.string().describe("Exact topic name from the topics list"),
      stage: z.enum(["Awareness", "Consideration", "Conversion", "Loyalty", "Other"]),
      branded: z.boolean().describe("True if the prompt names the brand directly"),
    }),
  ),
  hypotheses: z.array(
    z.object({
      expect: z.string().describe("What we'd expect an AI assistant to say or do today"),
      because: z.string(),
      confirmedBy: z.string().describe("What evidence would confirm this if you ran a live Scrunch monitor"),
      refutedBy: z.string(),
    }),
  ),
  citationPrompts: z
    .array(
      z.object({
        prompt: z
          .string()
          .describe("A non-branded buyer question this brand's site could reasonably be cited in"),
        note: z.string().describe("One line on why an assistant might cite this brand for that question"),
      }),
    )
    .min(4)
    .max(6),
  mentionRates: z
    .array(
      z.object({
        name: z.string(),
        website: z.string(),
        estimatedPct: z
          .number()
          .min(0)
          .max(100)
          .describe("Estimated share of AI answers that would mention this brand - a hypothesis, not a live measurement"),
        isAuditedBrand: z.boolean(),
      }),
    )
    .min(4)
    .max(6),
  visibility: z.object({
    score: z.number().min(0).max(100).describe("Composite 0-100 visibility score from presence, position, citation, sentiment"),
    presencePct: z.number().min(0).max(100).describe("Estimated % of unbranded queries where the brand appears"),
    positionScore: z.number().min(0).max(100),
    citationSharePct: z.number().min(0).max(100).describe("Estimated share of citations that are brand-owned URLs"),
    sentimentScore: z.number().min(0).max(100),
    headline: z
      .string()
      .describe("One punchy sentence like 'X is absent from Y% of relevant AI conversations. That's the audience competitors are speaking to instead.'"),
    presenceBand: z.enum(["Below average", "Average", "Healthy"]),
    positionBand: z.enum(["Below average", "Average", "Healthy"]),
    citationBand: z.enum(["Below average", "Average", "Healthy"]),
    sentimentBand: z.enum(["Below average", "Average", "Healthy"]),
    competitorPresence: z
      .array(
        z.object({
          name: z.string(),
          presencePct: z.number().min(0).max(100),
          gapPts: z.number().describe("Audited brand presence minus this row; 0 for the audited brand"),
          isYou: z.boolean(),
        }),
      )
      .min(3)
      .max(6),
    lostPrompts: z
      .array(
        z.object({
          prompt: z.string(),
          fillingBrand: z.string().describe("Competitor likely filling the gap, or empty if unknown"),
          fillingPct: z.number().min(0).max(100),
        }),
      )
      .min(3)
      .max(5),
    platforms: z
      .array(
        z.object({
          name: z.enum(["ChatGPT", "Gemini", "Perplexity", "Claude", "Microsoft Copilot"]),
          presencePct: z.number().min(0).max(100),
          position: z.enum(["Top", "Mid", "Low"]),
          sentiment: z.enum(["Positive", "Mixed", "Negative"]),
        }),
      )
      .length(5),
    narrative: z.object({
      ownedPct: z.number().min(0).max(100),
      lostToCompetitorsPct: z.number().min(0).max(100),
      mentionOpportunitiesPct: z.number().min(0).max(100),
    }),
    ownedUrls: z
      .array(z.object({ source: z.string().describe("Real brand URL"), estimatedCitations: z.number().int().min(0) }))
      .min(2)
      .max(4),
    competitorDomains: z
      .array(z.object({ source: z.string().describe("Competitor domain only"), estimatedCitations: z.number().int().min(0) }))
      .min(2)
      .max(4),
    mentionOpportunities: z
      .array(
        z.object({
          source: z.string().describe("Third-party URL an assistant might cite instead"),
          estimatedCitations: z.number().int().min(0),
        }),
      )
      .min(2)
      .max(4),
  }).optional(),
});

export type AeoAuditGenerated = z.infer<typeof auditReportSchema>;

export const AUDIT_SYSTEM_PROMPT = `You are running a free, light-touch AEO/GEO (AI/Generative Engine Optimization) discoverability audit for the Sitecore + Scrunch booth at Technology for Marketing 2026. Scrunch is now part of Sitecore.

Audience: a marketer who just typed their brand name and website into a booth kiosk and wants a fast, credible read on how AI assistants (ChatGPT, Claude, Google AI Overviews, Google AI Mode, Perplexity, Grok, Gemini, Copilot, Meta AI) likely see their brand today. This is research and hypothesis generation only - it does not call any live monitoring API and must never claim to.

## Method
1. Recon: prefer the fetched homepage text (nav, hero, FAQ, about) when available, then well-known public facts. Do not invent owned domains, emails, or products not evidenced. If the fetch is empty, still produce a credible, clearly-labelled best-effort audit from public knowledge and say so in readinessSummary.
2. Keep it light-touch and demo-sized: 4-6 topics, 4-6 real competitors, 3-5 personas, 12-18 sample prompts (not 40+), skewed toward non-branded buyer questions (~70%) across the funnel. Also produce exactly 5 citationPrompts (non-branded), 5 mentionRates (audited brand + 4 real competitors), and a visibility object in the shape of a Scrunch AI Visibility Report (score, presence, position, citation share, sentiment, competitor presence table, 3-5 lost prompts, 5 platforms, citation narrative, owned URLs, competitor domains, mention-opportunity sources).
3. Infer the primary country from the site (ccTLD, addresses, currency, "UK/US/EU" copy). Never default to United States unless the brand is genuinely US-primary.
4. Be honest and specific in the readiness rating and summary - this is a credibility-building lead magnet, not a sales pitch. A generic-sounding site with thin content, no FAQ language, and no clear differentiation should get "At risk" or "Developing", not "Strong".
5. Competitors must be real, named brands with real homepages - never invent domains.
6. Prompts must read like something a real person types into an AI assistant (natural language, not SEO keywords), each tagged to a real persona and topic from the lists above.
7. mentionRates are a research hypothesis of how often each brand would be named if those citation prompts were asked across the 9 assistants. They are independent rates (do not force them to sum to 100). Sort descending. Be honest: a thin or unknown brand often sits below category leaders - do not default the audited brand to #1.
8. visibility.competitorPresence must include the audited brand with isYou=true. visibility.platforms must be ChatGPT, Gemini, Perplexity, Claude, Microsoft Copilot. visibility.narrative owned + lostToCompetitors + mentionOpportunities should sum to ~100. estimatedCitations are relative hypotheses (not live counts) - use plausible integers.
9. Platforms considered (always the same set): ${AEO_PLATFORM_TOKENS}

## Hard rules
- Do not claim to have run a live check against ChatGPT, Perplexity, or any other assistant. This is a research-based hypothesis, not a measured result.
- Do not invent stakeholder emails, owned domains, or live citation counts. estimatedPct values are labelled hypotheses, not measured Scrunch results.
- Keep language plain and marketer-friendly - no internal Scrunch product jargon (no "wizard", "brand id", "org id", "CSV import").
- This works for ANY brand or website handed to you, in any industry.`;
