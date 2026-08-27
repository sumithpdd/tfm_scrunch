# TFM Scrunch

A small Next.js microsite for the **Sitecore + Scrunch** stand at
[Technology for Marketing 2026](https://www.technologyformarketing.co.uk/).

Booth visitors enter their name, company, email, and website and get a **free, light-touch
AEO/GEO discoverability audit**: who AI assistants would say asks about them, what they'd be
asked, who else gets named alongside them, and a plain-language readiness read. A second page,
**AI Marketing Skills**, showcases a working prompt library.

Forked from the `/scrunch` and `/ai-marketing-skills` routes of the internal `SitecoreAiDemoSenario`
demo repo — same stack and code style, trimmed down to a public, auth-free, two-page tool. No
visitor login, no multi-brand CMS, no live Scrunch API call. Booth leads are written with Firebase
Admin to Firestore collection `tmf_scrunch_leads`.

## How the audit works

1. Visitor submits name, company, email, and website on `/`.
2. `/audit` calls `POST /api/audit/generate`, which:
   - fetches the visitor's homepage text (SSRF-safe),
   - asks Gemini to research the brand and produce a Scrunch-style visibility brief (presence,
     position, citation share, sentiment), personas, topics, competitors, and sample prompts,
   - upserts the lead into Firestore `tmf_scrunch_leads` and the visibility brief + PDF into
     `tmf_scrunch_reports` (one document per visitor email).
3. The result renders on `/audit`, with CSV, PDF, and an email draft (attach the downloaded PDF).

This is **research-based, not a live citation check** — the UI and system prompt both say so.
Scrunch's real product measures actual mention rate over time; this microsite is the free,
lead-gen teaser for that.

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY + Firebase Admin vars
npm run dev
```

Open http://localhost:3000.

## Stand desk

Staff-only leads list (not in the public nav): **`/stand-desk`**. Unlock with `LEADS_ADMIN_SECRET`,
then search, filter, and download CSV.

## Branding

All visitor-facing copy — company name, presenter name/email, CTA label, event name, site URL —
lives in one place: `src/lib/site-config.ts`.

## Deploy

Vercel (or similar): set `GEMINI_API_KEY` (required) plus `FIREBASE_SERVICE_ACCOUNT_JSON`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `LEADS_ADMIN_SECRET` so booth leads persist and the stand
desk can open. See `.env.example`.

## Docs

- `AGENTS.md` — paths and conventions for AI coding agents
- `.cursor/rules/project.mdc`, `.cursor/rules/security.mdc` — architecture and security rules
- `.cursor/skills/tfm-scrunch-demo/SKILL.md` — project skill for AI coding agents
