/**
 * Central branding config for the TFM Scrunch booth microsite.
 * Keep this the single place that names the event, the presenter, and the CTA copy —
 * see AGENTS.md "Before you change code".
 */
export const SITE = {
  eventCode: "TMF",
  eventName: "Technology for Marketing 2026",
  eventUrl: "https://www.technologyformarketing.co.uk/",
  companyName: "Sitecore",
  productName: "Scrunch",
  presenterName: "Sumith Damodaran",
  presenterEmail: process.env.NEXT_PUBLIC_PRESENTER_EMAIL?.trim() || "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.sitecore.com/",
  ctaLabel: "Get your free AEO/GEO audit",
  demoCtaLabel: "Book a demo",
  dataRetentionDays: 30,
  consentLabel:
    "I understand my details will be stored for 30 days and will not be used for marketing purposes.",
  tagline: "Free AEO/GEO discoverability audit",
  heroHeadline: "Unlock the new way to",
  heroHeadlineEmphasis: "reach customers",
  heroSubcopy:
    "Scrunch — now part of Sitecore — is the key into the AI-first customer journey: see how AI assistants describe your brand, who they compare you to, and what buyers are actually asking.",
} as const;
