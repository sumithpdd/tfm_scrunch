import { NextRequest, NextResponse } from "next/server";
import { snapshotFromReport } from "@/lib/audit-types";
import { BOOTH_ACCOUNT_SEEDS, boothAccountVisitorEmail } from "@/lib/booth-accounts";
import { parseBoothEventCode } from "@/lib/booth-events";
import { SITE } from "@/lib/site-config";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { generateAeoAudit } from "@/server/audit/audit.service";
import { findLeadByWebsite, logLead, upsertCompanyRecord } from "@/server/audit/lead-log";
import { saveVisibilityReport } from "@/server/audit/report-store";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  const body = (await request.json().catch(() => ({}))) as { generate?: boolean };
  const generateMissing = body.generate !== false;
  const visitorEmail = boothAccountVisitorEmail();
  const results: {
    company: string;
    website: string;
    id: string;
    created: boolean;
    generated: boolean;
    error?: string;
  }[] = [];

  try {
    for (const account of BOOTH_ACCOUNT_SEEDS) {
      const existing = await findLeadByWebsite(account.website);
      const lead = await upsertCompanyRecord({
        company: account.company,
        website: account.website,
        name: existing?.name || account.aeName,
        email: existing?.email || visitorEmail,
        aeName: account.aeName,
        aeEmail: account.aeEmail,
        eventCode: SITE.eventCode,
      });
      const created = !existing;
      let generated = Boolean(lead.lastReport);
      let error: string | undefined;

      if (generateMissing && !lead.lastReport) {
        try {
          const { report, error: genError } = await generateAeoAudit({
            brandName: account.company,
            website: account.website,
          });
          if (genError && report.source === "fallback") {
            error = genError;
          } else {
            await logLead(
              { name: lead.name || account.aeName, company: account.company, email: lead.email || visitorEmail },
              account.company,
              account.website,
              snapshotFromReport(report),
              parseBoothEventCode(SITE.eventCode),
            );
            await saveVisibilityReport({
              lead: { name: lead.name || account.aeName, company: account.company, email: lead.email || visitorEmail },
              brandName: account.company,
              website: account.website,
              report,
            });
            generated = true;
          }
        } catch (err: unknown) {
          error = err instanceof Error ? err.message : String(err);
        }
      }

      results.push({
        company: account.company,
        website: account.website,
        id: lead.id,
        created,
        generated,
        error,
      });
    }

    return NextResponse.json({ success: true, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
