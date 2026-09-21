import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadByWebsite } from "@/server/audit/lead-log";
import { getVisibilityReportByEmail, getVisibilityReportByWebsite } from "@/server/audit/report-store";

export async function GET(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  const website = request.nextUrl.searchParams.get("website")?.trim() ?? "";
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!website && !email) {
    return NextResponse.json({ success: false, error: "Website or email is required." }, { status: 400 });
  }

  try {
    const report =
      (website ? await getVisibilityReportByWebsite(website, email) : null) ??
      (email ? await getVisibilityReportByEmail(email) : null);
    if (!report) {
      return NextResponse.json({ success: false, error: "No visibility report for this website yet." }, { status: 404 });
    }
    if (role !== "super" && website) {
      const lead = await getLeadByWebsite(website);
      if (lead?.reportHidden) return forbiddenForAEs();
    }
    return NextResponse.json({ success: true, report }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
