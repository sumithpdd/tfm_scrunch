import { SITE } from "@/lib/site-config";

export const GENERATION_STAGES = [
  "Checking your details…",
  "Reading your homepage…",
  "Reading extra pages you added…",
  "Researching how AI would describe you…",
  "Comparing you with brands AI names nearby…",
  "Writing your visibility brief…",
  "Saving your audit…",
] as const;

export const GENERATION_FACTS: { kicker: string; body: string }[] = [
  {
    kicker: "AEO, not just SEO",
    body: `Answer Engine Optimization is how ${SITE.productName} helps AI tools — ChatGPT, Gemini, Perplexity, Claude — discover, understand, and cite your pages when someone asks a question.`,
  },
  {
    kicker: "Mention rate",
    body: `That's how often an AI names your brand in its answer. ${SITE.productName} tracks it the way analytics tracks website visits — except the "page" is a conversation.`,
  },
  {
    kicker: "Citation rate",
    body: `Even better than a name-drop: a citation. That's when the assistant uses your URL as a source. ${SITE.productName} measures both, then shows the gap versus competitors.`,
  },
  {
    kicker: `${SITE.companyName} + ${SITE.productName}`,
    body: `${SITE.productName} is now part of ${SITE.companyName}. In SitecoreAI it spans Strategy (signals), Channels (which pages to fix), and Page builder (apply the rewrite).`,
  },
  {
    kicker: "Signals, not noise",
    body: `${SITE.productName} watches ChatGPT, Gemini, and Perplexity for statistically meaningful shifts — a sudden mention-rate drop, or a competitor stealing citations on a topic.`,
  },
  {
    kicker: "Citeability vs retrievability",
    body: `Citeability is "would an AI trust this page enough to quote it?" Retrievability is "can it even find and extract the answer?" High scores on both is the AEO jackpot.`,
  },
  {
    kicker: "You can't force the model",
    body: `Same rule as SEO: you don't control the ranking, you influence it. Clear, authoritative, answer-first content is what assistants like to reuse.`,
  },
  {
    kicker: "Knowledge Studio",
    body: `A lot of brand truth lives in ${SITE.companyName} DAM or Content Hub — not on the public web. ${SITE.productName} Knowledge Studio turns those approved docs into a living source for AI tools.`,
  },
  {
    kicker: "This brief is the teaser",
    body: `What you're waiting on is a research snapshot. The live ${SITE.productName} report watches hundreds of prompts over 7, 30, or 90 days — mention rate, citations, sentiment, the lot.`,
  },
  {
    kicker: "Monitor → surface → publish → measure",
    body: `${SITE.productName} monitors AI answers, SitecoreAI surfaces the signal and the rewrite, you publish, then ${SITE.productName} measures whether the assistants noticed.`,
  },
];
