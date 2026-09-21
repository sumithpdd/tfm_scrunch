import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadById } from "@/server/audit/lead-log";
import { connectScrunchDiff } from "@/server/scrunch/sync";

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as { id?: string };
    const lead = body.id?.trim() ? await getLeadById(body.id.trim()) : null;
    if (!lead) {
      return NextResponse.json({ success: false, error: "Company not found." }, { status: 404 });
    }
    if (!lead.scrunchSetup) {
      return NextResponse.json(
        { success: false, error: "Generate Scrunch settings first." },
        { status: 400 },
      );
    }

    const diff = await connectScrunchDiff({
      ...lead.scrunchSetup,
      scrunchOrgId: lead.scrunchOrgId || lead.scrunchSetup.scrunchOrgId,
      scrunchBrandId: lead.scrunchBrandId || lead.scrunchSetup.scrunchBrandId,
    });
    return NextResponse.json({ success: true, diff }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
