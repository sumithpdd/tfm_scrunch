import { NextRequest, NextResponse } from "next/server";
import type { ScrunchSyncAction } from "@/lib/scrunch-diff-types";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadById } from "@/server/audit/lead-log";
import { applyScrunchSync } from "@/server/scrunch/sync";

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as { id?: string; action?: ScrunchSyncAction };
    const lead = body.id?.trim() ? await getLeadById(body.id.trim()) : null;
    if (!lead?.scrunchSetup) {
      return NextResponse.json(
        { success: false, error: "Generate Scrunch settings first." },
        { status: 400 },
      );
    }
    if (!body.action) {
      return NextResponse.json({ success: false, error: "Sync action is required." }, { status: 400 });
    }

    const result = await applyScrunchSync({
      leadId: lead.id,
      doc: {
        ...lead.scrunchSetup,
        scrunchOrgId: lead.scrunchOrgId || lead.scrunchSetup.scrunchOrgId,
        scrunchBrandId: lead.scrunchBrandId || lead.scrunchSetup.scrunchBrandId,
      },
      action: body.action,
    });
    return NextResponse.json(
      {
        success: true,
        setup: result.doc,
        diff: result.diff,
        notice: result.notice,
        error: result.warnings.length ? result.warnings.join(" · ") : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
