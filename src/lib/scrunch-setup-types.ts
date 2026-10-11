/** Scrunch brand-setup build sheet — stored in Firestore `scrunch_brands/{setupId}`. */

import type { GeminiTokenUsage } from "@/lib/gemini-usage";

export type ScrunchBrandRelationship = "customer" | "prospect";

/** Sheet lifecycle — skill ends at BUILT after human wizard + CSV. */
export type ScrunchSetupStatus = "INTAKE" | "PLANNED" | "APPROVED" | "BUILT";

export const SCRUNCH_PLATFORM_TOKENS =
  "chatgpt, claude, google_ai_overviews, google_ai_mode, perplexity, grok, google_gemini, copilot, meta";

export type ScrunchAltName = { name: string; why: string };
export type ScrunchAltWebsite = { url: string; ownership: string };
export type ScrunchCompetitor = {
  name: string;
  altNames: string;
  website: string;
  whyInScope: string;
};
export type ScrunchRemovedCompetitor = { name: string; why: string };
export type ScrunchSubBrand = { name: string; websites: string; altNames: string };
export type ScrunchPersona = { name: string; description: string };
export type ScrunchTopic = { name: string; description: string };
export type ScrunchPromptRow = {
  prompt: string;
  personas: string;
  geos: string;
  languages: string;
  platforms: string;
  topics: string;
  tags: string;
  stage: string;
  branded: boolean;
};
export type ScrunchHypothesis = {
  expect: string;
  because: string;
  confirmedBy: string;
  refutedBy: string;
};
export type ScrunchOpenQuestion = {
  question: string;
  blocks: string;
  howToSettle: string;
};
export type ScrunchStakeholder = { name: string; email: string };

export type ScrunchCounts = {
  topics: number;
  competitors: number;
  personas: number;
  seeds: number;
  nonBrandedCount: number;
  nonBrandedPct: number;
  platforms: number;
  variantsEstimate: number;
};

export type ScrunchBrandSetupDoc = {
  setupId: string;
  brandName: string;
  website: string;
  /** Scrunch wizard first click: Customer vs Prospect. Customer cannot be changed later. */
  relationship: ScrunchBrandRelationship;
  primaryCountry: string;
  /** Label as shown in Review (e.g. United Kingdom). Wizard default is US — never leave it. */
  primaryCountryLabel: string;
  defaultLanguage: string;
  caseSensitive: boolean;
  description: string;
  alternativeNames: ScrunchAltName[];
  alternativeWebsites: ScrunchAltWebsite[];
  competitors: ScrunchCompetitor[];
  removedCompetitors: ScrunchRemovedCompetitor[];
  subBrands: ScrunchSubBrand[];
  personas: ScrunchPersona[];
  topics: ScrunchTopic[];
  prompts: ScrunchPromptRow[];
  counts: ScrunchCounts;
  hypotheses: ScrunchHypothesis[];
  openQuestions: ScrunchOpenQuestion[];
  briefMarkdown: string;
  scopeDecision: string;
  wizardHandoff: string;
  biasNotes: string;
  intakeNotes: string;
  stakeholders: ScrunchStakeholder[];
  successMeasures: string[];
  geographicScope: string;
  status: ScrunchSetupStatus;
  /** Scrunch org id after create (from Scrunch UI). Used with MCP / API. Never hardcode real ids in source. */
  scrunchOrgId?: string;
  /** Scrunch brand id after create (from Scrunch UI). Used with MCP / API. Never hardcode real ids in source. */
  scrunchBrandId?: string;
  /** Email of the AE or visitor who owns this setup — never leave undefined for Firestore. */
  createdByUid: string;
  createdByEmail: string;
  source: "gemini" | "intake";
  skillSourceUrl: string;
  geminiUsage?: GeminiTokenUsage;
  updatedAt?: unknown;
};

export type ScrunchSetupSummary = {
  setupId: string;
  brandName: string;
  website: string;
  status: ScrunchSetupStatus;
  source: string;
  promptCount: number;
  scrunchOrgId?: string;
  scrunchBrandId?: string;
};
