import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadById, saveScrunchIds } from "@/server/audit/lead-log";
import { checkScrunchBrand } from "@/server/scrunch/check-brand";

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as { id?: string; orgId?: string; brandId?: string };
    const id = body.id?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ success: false, error: "Lead id is required." }, { status: 400 });
    }
    const existing = await getLeadById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Company not found." }, { status: 404 });
    }

    const check = await checkScrunchBrand({
      company: existing.company || existing.auditedBrand,
      website: existing.auditedWebsite,
      orgId: body.orgId?.trim() || existing.scrunchOrgId,
      brandId: body.brandId?.trim() || existing.scrunchBrandId,
    });

    if (!check.found || !check.brandId) {
      return NextResponse.json({ success: false, error: check.message, check }, { status: 404 });
    }

    const lead = await saveScrunchIds({
      id,
      orgId: check.orgId || existing.scrunchOrgId,
      brandId: check.brandId,
      brandName: check.brandName,
    });
    return NextResponse.json({ success: true, lead, check }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
