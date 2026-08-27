import { NextRequest, NextResponse } from "next/server";
import { generateAeoAudit } from "@/server/audit/audit.service";
import { logLead } from "@/server/audit/lead-log";
import { saveVisibilityReport } from "@/server/audit/report-store";
import type { GenerateAuditRequest } from "@/lib/audit-types";
import { snapshotFromReport } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";

export const maxDuration = 60;

// Simple in-memory throttle: this is a public, unauthenticated booth kiosk endpoint that
// calls a paid Gemini API, so cap requests per IP per minute. Resets on redeploy/restart —
// good enough for a two-day event, not a production rate limiter.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many audits from this device right now — try again in a minute." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as Partial<GenerateAuditRequest>;
    const brandName = body.brandName?.trim();
    const website = body.website?.trim();
    const lead = body.lead;

    if (!brandName || !website) {
      return NextResponse.json(
        { success: false, error: "Company name and website are required." },
        { status: 400 },
      );
    }
    if (!lead?.name?.trim() || !lead?.email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name and email are required to run the free audit." },
        { status: 400 },
      );
    }
    if (body.consentAccepted !== true) {
      return NextResponse.json(
        { success: false, error: SITE.consentLabel },
        { status: 400 },
      );
    }

    const { report, error } = await generateAeoAudit({ brandName, website });

    await logLead(
      { name: lead.name.trim(), company: lead.company?.trim() ?? "", email: lead.email.trim() },
      brandName,
      website,
      error && report.source === "fallback" ? null : snapshotFromReport(report),
    );

    if (error && report.source === "fallback") {
      return NextResponse.json({ success: false, error }, { status: 502 });
    }

    await saveVisibilityReport({
      lead: { name: lead.name.trim(), company: lead.company?.trim() ?? "", email: lead.email.trim() },
      brandName,
      website,
      report,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
