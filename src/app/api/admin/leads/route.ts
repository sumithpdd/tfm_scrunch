import { NextRequest, NextResponse } from "next/server";
import { isStandDeskUnlocked } from "@/server/admin/stand-desk-auth";
import { listLeads } from "@/server/audit/lead-log";

export async function GET(request: NextRequest) {
  if (!isStandDeskUnlocked(request)) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const leads = await listLeads();
    return NextResponse.json(
      { success: true, leads },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
