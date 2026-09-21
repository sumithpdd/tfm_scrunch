/** Marketing skill / agent prompt library — `marketing_skills/{skillId}` */

export type MarketingSkillCategoryColor =
  | "purple"
  | "blue"
  | "green"
  | "violet"
  | "cyan"
  | "amber";

export type MarketingSkillTrigger =
  | "manual"
  | "schedule-weekly"
  | "schedule-monthly"
  | "schedule-weekly-manual";

export type MarketingSkillTool = {
  toolId: string;
  name: string;
};

export type MarketingSkillSource = "sitecore" | "magister";

/** Prompt library document — one skill/agent per doc */
export type MarketingSkillDoc = {
  skillId: string;
  /** Display name e.g. SEO_Keyword_Monitor */
  name: string;
  slug: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: MarketingSkillCategoryColor;
  description: string;
  trigger: MarketingSkillTrigger;
  /** Human label e.g. "Schedule — Weekly" */
  triggerLabel: string;
  tools: MarketingSkillTool[];
  systemPrompt: string;
  sortOrder: number;
  enabled: boolean;
  source: MarketingSkillSource;
  sourceUrl?: string;
  updatedAt?: unknown;
};

export type MarketingSkillUpdate = Partial<
  Pick<
    MarketingSkillDoc,
    | "name"
    | "description"
    | "trigger"
    | "triggerLabel"
    | "tools"
    | "systemPrompt"
    | "enabled"
    | "categoryLabel"
    | "categoryColor"
  >
>;
