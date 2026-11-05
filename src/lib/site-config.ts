/**
 * Central branding config for the public AEO/GEO audit.
 * Keep this the single place that names the product, presenter, and CTA copy —
 * see AGENTS.md "Before you change code".
 */
export const SITE = {
  eventCode: "MARTECH",
  eventName: "The MarTech Summit London",
  eventUrl: "https://themartechsummit.com/",
  companyName: "Sitecore",
  productName: "Scrunch",
  presenterName: "Sumith Damodaran",
  presenterEmail: process.env.NEXT_PUBLIC_PRESENTER_EMAIL?.trim() || "",
  /** Empty on the public form — visitors must enter their own work email. */
  defaultVisitorEmail: "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.sitecore.com/",
  ctaLabel: "Run my free AEO/GEO audit",
  demoCtaLabel: "Talk to Sitecore",
  dataRetentionDays: 30,
  consentLabel:
    "I understand my details will be stored for 30 days and will not be used for marketing purposes.",
  tagline: "Free AEO/GEO discoverability audit",
  heroHeadline: "See how AI talks about",
  heroHeadlineEmphasis: "your brand",
  heroSubcopy:
    "Enter your name, work email, company, and website. Scrunch — now part of Sitecore — researches how AI assistants would describe you, who they compare you to, and what buyers are asking.",
  fallbackAuditUrl: "https://scrunch.com/brand-audit/",
  fallbackAuditLabel: "If this breaks, use this version",
} as const;
