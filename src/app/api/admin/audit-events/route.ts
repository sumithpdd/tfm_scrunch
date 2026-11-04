import { NextRequest, NextResponse } from "next/server";
import { getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { listRecentAuditEvents } from "@/server/audit/event-log";

export async function GET(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const events = await listRecentAuditEvents(150);
    // Error text can mention internal config (deployment names, schema paths) -- keep it
    // to the super-admin role, same spirit as the rest of stand-desk's role split.
    const presented =
      role === "super"
        ? events
        : events.map((e) => ({ ...e, error: e.error ? "(see super admin)" : "" }));
    return NextResponse.json(
      { success: true, role, events: presented },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
