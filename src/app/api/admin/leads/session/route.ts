import { NextRequest, NextResponse } from "next/server";
import {
  isStandDeskUnlocked,
  isUnlockRateLimited,
  lockResponse,
  standDeskSecretConfigured,
  submittedSecretMatches,
  unlockResponse,
} from "@/server/admin/stand-desk-auth";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ unlocked: isStandDeskUnlocked(request) });
}

export async function POST(request: NextRequest) {
  if (!standDeskSecretConfigured()) {
    return NextResponse.json({ success: false, error: "Stand desk is not configured." }, { status: 503 });
  }

  const ip = clientIp(request);
  if (isUnlockRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts — wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let secret = "";
  try {
    const body = (await request.json()) as { secret?: string };
    secret = body.secret?.trim() ?? "";
  } catch {
    return NextResponse.json({ success: false, error: "Passcode required." }, { status: 400 });
  }

  if (!secret || !submittedSecretMatches(secret)) {
    return NextResponse.json({ success: false, error: "That passcode doesn't match." }, { status: 401 });
  }

  return unlockResponse();
}

export async function DELETE() {
  return lockResponse();
}
