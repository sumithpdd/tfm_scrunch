# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

**TFM Scrunch** — a public-facing Next.js microsite for a free, light-touch **AEO/GEO
discoverability audit**. Visitors enter their name, work email, company, website, and optional
extra page URLs. Gemini researches the site. A second page, **AI Marketing Skills**, is a
Claude-ready prompt library.

Forked from the `/scrunch` and `/ai-marketing-skills` routes of `SitecoreAiDemoSenario`. No
visitor login. Firebase Admin persists leads in `tmf_scrunch_leads` and request logs in
`tmf_scrunch_audit_events`. Hidden `/stand-desk` remains staff-only.

## Audience

Anyone who wants a research-based AEO/GEO snapshot of a public website. Secondary audience:
Sitecore/Scrunch sellers reusing the Claude skill pack.

## Before you change code

1. Read `.cursor/rules/project.mdc` and `.cursor/rules/security.mdc`
2. Branding (company, presenter, CTA copy, event name) lives in one place: `src/lib/site-config.ts`
   — change it there, not by hunting through components.
3. Never commit secrets or real keys to docs.

## Key paths

| Area | Path |
|------|------|
| Branding / copy config | `src/lib/site-config.ts` |
| Landing page + lead form | `src/app/page.tsx`, `src/components/lead-capture-hero.tsx` |
| Audit results UI | `src/app/audit/page.tsx`, `src/components/audit-workspace.tsx`, `src/components/mention-rate-report.tsx` |
| Audit types | `src/lib/audit-types.ts` |
| Audit Gemini prompt/schema | `src/server/audit/prompts/audit-brief.ts` |
| Audit generation service | `src/server/audit/audit.service.ts` |
| Audit API route | `src/app/api/audit/generate/route.ts` |
| Lead capture | `src/server/audit/lead-log.ts` (Firestore `tmf_scrunch_leads` + `data/leads.jsonl`) |
| Visibility reports + PDFs | `src/server/audit/report-store.ts` (Firestore `tmf_scrunch_reports`, one doc per website) |
| Firebase Admin | `src/lib/firebase-admin.ts`, `src/server/db/firestore-admin.ts` |
| Marketing skills catalog | `src/lib/marketing-skills-seed.ts`, `src/components/marketing-skills-view.tsx` |
| Marketing skills API | `src/app/api/marketing-skills/route.ts`, `src/app/api/marketing-skills/email/route.ts` |
| Stand desk (hidden leads UI) | `src/app/stand-desk/page.tsx`, `src/components/stand-desk-view.tsx` |
| Scrunch PDF store | `src/server/audit/pdf-store.ts`, `src/app/api/admin/reports/pdf/route.ts` |
| Stand desk API | `src/app/api/admin/leads/route.ts`, `src/app/api/admin/leads/session/route.ts`, `src/app/api/admin/leads/seed/route.ts` |
| Scrunch brand setup (super) | `src/server/scrunch/brand-setup.service.ts`, `src/app/api/admin/scrunch/generate/route.ts`, `src/app/api/admin/scrunch/connect/route.ts`, `src/app/api/admin/scrunch/entity-sync/route.ts` |
| Report PDF | `src/lib/report-pdf.ts`, `src/components/report-share-actions.tsx` |
| Email report | `src/app/api/audit/email/route.ts` (disabled until a verified sender exists) |
| Audit request log | `src/server/audit/event-log.ts` (Firestore `tmf_scrunch_audit_events`) |
| Public bot guards | `src/server/security/turnstile.ts`, `src/server/security/rate-limit.ts` |

## Common tasks

- **Change branding / CTA / contact info**: edit `src/lib/site-config.ts` only.
- **Add/edit a marketing skill**: edit `src/lib/marketing-skills-seed.ts` (ships in code — no
  admin UI).
- **Tune the audit's tone/scope**: edit `AUDIT_SYSTEM_PROMPT` in
  `src/server/audit/prompts/audit-brief.ts`.
- **Export leads captured at the booth**: open the hidden `/stand-desk` page (passcode =
  `LEADS_ADMIN_SECRET`), or the Firestore collection `tmf_scrunch_leads`. `data/leads.jsonl` is a
  local fallback.
- **Email the visitor a PDF**: disabled in the UI and API until a verified sender exists.
  Download PDF still works.
- **Deploy**: set `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `LEADS_ADMIN_SECRET`, and in production
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. See `.env.example`.

## Do not

- Put API keys, Gemini keys, or Scrunch org/brand ids in markdown, UI placeholders, or committed
  env files.
- Call Gemini from client components (server routes / server-only modules only).
- Add a login/auth layer on the visitor kiosk without also adding a reason — booth visitors should
  never see a sign-in screen. The `/stand-desk` passcode is staff-only and must stay off the nav.
- Claim the audit is a live Scrunch/AI-assistant check. It is Gemini research and hypothesis
  generation — say so in the UI and prompt (`AUDIT_SYSTEM_PROMPT` enforces this; keep it that way).
