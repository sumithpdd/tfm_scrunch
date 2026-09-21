import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { saveScrunchIds } from "@/server/audit/lead-log";

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as {
      id?: string;
      orgId?: string;
      brandId?: string;
      brandName?: string;
    };
    if (!body.id?.trim()) {
      return NextResponse.json({ success: false, error: "Lead id is required." }, { status: 400 });
    }
    const lead = await saveScrunchIds({
      id: body.id.trim(),
      orgId: body.orgId ?? "",
      brandId: body.brandId ?? "",
      brandName: body.brandName,
    });
    return NextResponse.json({ success: true, lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
