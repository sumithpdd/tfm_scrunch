import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadById, listLeads, presentLeadForRole, updateLeadAe, updateLeadEmail, upsertCompanyRecord } from "@/server/audit/lead-log";
import { updateReportEmailByWebsite } from "@/server/audit/report-store";

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
      aeName?: string;
      aeEmail?: string;
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
      aeName: body.aeName,
      aeEmail: body.aeEmail,
      scrunchOrgId: superOnly ? body.scrunchOrgId : undefined,
      scrunchBrandId: superOnly ? body.scrunchBrandId : undefined,
    });
    return NextResponse.json({ success: true, lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      email?: string;
      aeName?: string;
      aeEmail?: string;
    };
    const id = body.id?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ success: false, error: "Company id is required." }, { status: 400 });
    }

    const existing = await getLeadById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Company not found." }, { status: 404 });
    }
    if (role !== "super" && existing.archived) return forbiddenForAEs();

    let lead = existing;
    if (body.email?.trim()) {
      lead = await updateLeadEmail(id, body.email);
      if (lead.auditedWebsite) {
        await updateReportEmailByWebsite(lead.auditedWebsite, body.email);
      }
    }
    if (body.aeName !== undefined || body.aeEmail !== undefined) {
      lead = await updateLeadAe(id, {
        aeName: body.aeName ?? lead.aeName,
        aeEmail: body.aeEmail ?? lead.aeEmail,
      });
    }
    return NextResponse.json(
      { success: true, lead: presentLeadForRole(lead, role) ?? lead },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
