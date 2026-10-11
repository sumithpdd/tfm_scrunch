import { NextResponse } from "next/server";

export const maxDuration = 30;

/** Email sending is disabled until a Sitecore-approved sender is configured. */
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Email sending is not configured." },
    { status: 503 },
  );
}

/*
Previous implementation used Resend via sendBoothEmail() with rate limits.
Re-enable when EMAIL_FROM is a verified sender: restore sendBoothEmail from
src/server/mail/resend.ts and attach the audit PDF.
*/
