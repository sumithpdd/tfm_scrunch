import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { removeLead, setLeadModeration } from "@/server/audit/lead-log";

const ACTIONS = ["archive", "unarchive", "hide", "unhide", "remove"] as const;
type ModerateAction = (typeof ACTIONS)[number];

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  try {
    const body = (await request.json()) as { id?: string; action?: string };
    const id = body.id?.trim() ?? "";
    const action = body.action as ModerateAction | undefined;
    if (!id || !action || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: "Company id and action are required." }, { status: 400 });
    }

    if (action === "remove") {
      await removeLead(id);
      return NextResponse.json({ success: true, removed: id }, { headers: { "Cache-Control": "no-store" } });
    }

    const lead = await setLeadModeration({
      id,
      ...(action === "archive" ? { archived: true } : {}),
      ...(action === "unarchive" ? { archived: false } : {}),
      ...(action === "hide" ? { reportHidden: true } : {}),
      ...(action === "unhide" ? { reportHidden: false } : {}),
    });
    return NextResponse.json({ success: true, lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
