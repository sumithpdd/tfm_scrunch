# TFM Scrunch — project skill

Use when working on the TFM Scrunch booth microsite: the free AEO/GEO audit, the AI marketing
skills catalog, or deployment.

## Read first

- `AGENTS.md` — paths and conventions
- `.cursor/rules/security.mdc` — secrets, public API routes, rate limiting
- `src/lib/site-config.ts` — every piece of visitor-facing branding/copy

## Security (always)

- No real keys in docs, `.env.example`, or commits
- Server-only: `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`),
  `LEADS_ADMIN_SECRET`
- `/api/audit/generate` and `/api/marketing-skills` are intentionally public — do not add auth
  without a real login flow to back it
- `/stand-desk` is staff-only (passcode). Do not add it to the visitor nav.
- Keep the in-process rate limit on `/api/audit/generate`

## Common edits

| Task | Files |
|------|-------|
| Branding / CTA / contact info | `src/lib/site-config.ts` |
| Landing page copy / hero | `src/app/page.tsx`, `src/components/lead-capture-hero.tsx` |
| Audit tone, scope, schema | `src/server/audit/prompts/audit-brief.ts` |
| Audit generation logic | `src/server/audit/audit.service.ts` |
| Audit results UI | `src/components/audit-workspace.tsx`, `mention-rate-report.tsx` |
| Marketing skill content | `src/lib/marketing-skills-seed.ts` |
| Marketing skills UI | `src/components/marketing-skills-view.tsx`, `marketing-skill-modal.tsx` |
| Stand desk leads list | `src/app/stand-desk/page.tsx`, `src/components/stand-desk-view.tsx` |

## Verify before shipping

```bash
npm run lint
npm run build
```

Then smoke-test locally with `npm run dev`: submit the landing form, confirm `/audit` auto-runs
and renders a report, and confirm a doc appears in Firestore `tmf_scrunch_leads` (and a new line
in `data/leads.jsonl`). Unlock `/stand-desk` with `LEADS_ADMIN_SECRET` and confirm the lead lists.
