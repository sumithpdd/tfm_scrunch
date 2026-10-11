import { NextRequest, NextResponse } from "next/server";
import { getStandDeskRole } from "@/server/admin/stand-desk-auth";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  // Email sending is disabled until a Sitecore-approved sender is configured.
  return NextResponse.json(
    { success: false, error: "Email sending is not configured." },
    { status: 503 },
  );
}

/*
Previous implementation attached the official Scrunch PDF and/or micro-audit brief
via sendBoothEmail() (Resend). Re-enable when EMAIL_FROM is a verified sender.
*/
