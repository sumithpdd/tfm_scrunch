import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { STAND_DESK_COOKIE } from "@/lib/stand-desk";

const WINDOW_MS = 15 * 60_000;
const MAX_UNLOCK_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

export function standDeskSecretConfigured(): boolean {
  return Boolean(process.env.LEADS_ADMIN_SECRET?.trim());
}

function expectedToken(): string | null {
  const secret = process.env.LEADS_ADMIN_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret).update("tfm-stand-desk-v1").digest("hex");
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isUnlockRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_UNLOCK_PER_WINDOW;
}

export function isStandDeskUnlocked(request: NextRequest): boolean {
  const expected = expectedToken();
  const got = request.cookies.get(STAND_DESK_COOKIE)?.value;
  if (!expected || !got) return false;
  return secretsEqual(got, expected);
}

export function unlockResponse(): NextResponse {
  const token = expectedToken();
  if (!token) {
    return NextResponse.json({ success: false, error: "Stand desk is not configured." }, { status: 503 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(STAND_DESK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 14,
  });
  return res;
}

export function lockResponse(): NextResponse {
  const res = NextResponse.json({ success: true });
  res.cookies.set(STAND_DESK_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export function submittedSecretMatches(secret: string): boolean {
  const expected = process.env.LEADS_ADMIN_SECRET?.trim();
  if (!expected) return false;
  return secretsEqual(secret.trim(), expected);
}
