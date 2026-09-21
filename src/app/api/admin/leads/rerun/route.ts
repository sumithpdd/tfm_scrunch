import { NextRequest, NextResponse } from "next/server";
import { snapshotFromReport } from "@/lib/audit-types";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { generateAeoAudit } from "@/server/audit/audit.service";
import { parseBoothEventCode } from "@/lib/booth-events";
import { getLeadById, logLead } from "@/server/audit/lead-log";
import { saveVisibilityReport } from "@/server/audit/report-store";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Lead id is required." }, { status: 400 });
    }

    const lead = await getLeadById(id);
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found." }, { status: 404 });
    }
    if (role !== "super" && (lead.archived || lead.reportHidden)) {
      return forbiddenForAEs();
    }

    const brandName = lead.auditedBrand || lead.company;
    const website = lead.auditedWebsite;
    if (!brandName || !website) {
      return NextResponse.json(
        { success: false, error: "This lead is missing a company or website." },
        { status: 400 },
      );
    }

    const { report, error } = await generateAeoAudit({ brandName, website });
    if (error && report.source === "fallback") {
      return NextResponse.json({ success: false, error }, { status: 502 });
    }

    const snapshot = snapshotFromReport(report);
    await logLead(
      { name: lead.name, company: lead.company, email: lead.email },
      brandName,
      website,
      snapshot,
      parseBoothEventCode(lead.eventCode),
    );
    await saveVisibilityReport({
      lead: { name: lead.name, company: lead.company, email: lead.email },
      brandName,
      website,
      report,
    });

    return NextResponse.json(
      { success: true, report, snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
