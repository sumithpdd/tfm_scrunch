import { NextRequest, NextResponse } from "next/server";
import { getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { listLeads, presentLeadForRole, upsertCompanyRecord } from "@/server/audit/lead-log";

export async function GET(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const leads = (await listLeads())
      .map((lead) => presentLeadForRole(lead, role))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
    return NextResponse.json(
      { success: true, role, leads },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      company?: string;
      website?: string;
      name?: string;
      email?: string;
      eventCode?: string;
      scrunchOrgId?: string;
      scrunchBrandId?: string;
    };
    const superOnly = role === "super";
    const lead = await upsertCompanyRecord({
      company: body.company?.trim() ?? "",
      website: body.website?.trim() ?? "",
      name: body.name,
      email: body.email,
      eventCode: body.eventCode,
      scrunchOrgId: superOnly ? body.scrunchOrgId : undefined,
      scrunchBrandId: superOnly ? body.scrunchBrandId : undefined,
    });
    return NextResponse.json({ success: true, lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
