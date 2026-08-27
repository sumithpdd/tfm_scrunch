import { NextRequest, NextResponse } from "next/server";
import { isStandDeskUnlocked } from "@/server/admin/stand-desk-auth";
import { getVisibilityReportByEmail } from "@/server/audit/report-store";

export async function GET(request: NextRequest) {
  if (!isStandDeskUnlocked(request)) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!email) {
    return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
  }

  try {
    const report = await getVisibilityReportByEmail(email);
    if (!report) {
      return NextResponse.json({ success: false, error: "No visibility report for this email yet." }, { status: 404 });
    }
    return NextResponse.json({ success: true, report }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
