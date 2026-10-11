import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { createdByEmailForLead, getLeadById, saveLeadScrunchSetup } from "@/server/audit/lead-log";
import { generateScrunchSetup } from "@/server/scrunch/brand-setup.service";
import { SITE } from "@/lib/site-config";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim() ?? "";
    const lead = id ? await getLeadById(id) : null;
    if (!lead?.auditedWebsite) {
      return NextResponse.json({ success: false, error: "Company not found." }, { status: 404 });
    }

    const createdBy = createdByEmailForLead(lead) || SITE.defaultVisitorEmail;
    const { doc, error } = await generateScrunchSetup({
      setupId: lead.id,
      brandName: lead.auditedBrand || lead.company,
      website: lead.auditedWebsite,
      intakeNotes: "",
      geographicScope: "",
      relationship: "customer",
      stakeholders: lead.aeEmail
        ? [{ name: lead.aeName || "Account exec", email: lead.aeEmail }]
        : [],
      successMeasures: [],
      createdByUid: createdBy,
      scrunchOrgId: lead.scrunchOrgId || "",
      scrunchBrandId: lead.scrunchBrandId || "",
      regenerate: Boolean(lead.scrunchSetup),
      previousSummary: lead.scrunchSetup?.briefMarkdown || "",
    });

    if (error && !doc.description && !doc.personas.length) {
      return NextResponse.json({ success: false, error }, { status: 502 });
    }

    const saved = await saveLeadScrunchSetup(lead.id, {
      ...doc,
      createdByUid: createdBy,
      createdByEmail: createdBy,
      scrunchOrgId: lead.scrunchOrgId || doc.scrunchOrgId || "",
      scrunchBrandId: lead.scrunchBrandId || doc.scrunchBrandId || "",
    });
    return NextResponse.json(
      {
        success: true,
        setup: saved.scrunchSetup,
        lead: saved,
        warning: error,
        usage: saved.scrunchSetup?.geminiUsage ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
