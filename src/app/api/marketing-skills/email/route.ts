import { NextResponse } from "next/server";

export const maxDuration = 30;

/** Email sending is disabled until a Sitecore-approved sender is configured. */
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Email sending is not configured. Download the Claude skill pack instead." },
    { status: 503 },
  );
}

/*
Previous implementation emailed a Claude skill zip via Resend.
Re-enable when EMAIL_FROM is a verified sender.
*/
