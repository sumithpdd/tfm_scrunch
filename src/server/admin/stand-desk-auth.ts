import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { STAND_DESK_COOKIE, type StandDeskRole } from "@/lib/stand-desk";

const WINDOW_MS = 15 * 60_000;
const MAX_UNLOCK_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function aeSecret(): string | null {
  return process.env.LEADS_ADMIN_SECRET?.trim() || null;
}

function superSecret(): string | null {
  return process.env.LEADS_SUPER_ADMIN_SECRET?.trim() || null;
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function tokenFor(role: StandDeskRole, secret: string): string {
  const hmac = createHmac("sha256", secret).update(`tfm-stand-desk-v2:${role}`).digest("hex");
  return `${role}.${hmac}`;
}

function legacyAeToken(): string | null {
  const secret = aeSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update("tfm-stand-desk-v1").digest("hex");
}

export function standDeskSecretConfigured(): boolean {
  return Boolean(aeSecret() || superSecret());
}

export function isUnlockRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_UNLOCK_PER_WINDOW;
}

export function matchStandDeskSecret(secret: string): StandDeskRole | null {
  const submitted = secret.trim();
  if (!submitted) return null;
  const superKey = superSecret();
  const aeKey = aeSecret();
  if (superKey && secretsEqual(submitted, superKey)) return "super";
  if (aeKey && secretsEqual(submitted, aeKey)) return "ae";
  return null;
}

export function getStandDeskRole(request: NextRequest): StandDeskRole | null {
  const got = request.cookies.get(STAND_DESK_COOKIE)?.value;
  if (!got) return null;

  if (got.startsWith("super.")) {
    const key = superSecret();
    if (!key) return null;
    return secretsEqual(got, tokenFor("super", key)) ? "super" : null;
  }
  if (got.startsWith("ae.")) {
    const key = aeSecret();
    if (!key) return null;
    return secretsEqual(got, tokenFor("ae", key)) ? "ae" : null;
  }

  const legacy = legacyAeToken();
  if (legacy && secretsEqual(got, legacy)) return "ae";
  return null;
}

export function isStandDeskUnlocked(request: NextRequest): boolean {
  return getStandDeskRole(request) !== null;
}

export function isSuperAdmin(request: NextRequest): boolean {
  return getStandDeskRole(request) === "super";
}

export function unlockResponse(role: StandDeskRole): NextResponse {
  const secret = role === "super" ? superSecret() : aeSecret();
  if (!secret) {
    return NextResponse.json({ success: false, error: "Stand desk is not configured." }, { status: 503 });
  }
  const res = NextResponse.json({ success: true, role });
  res.cookies.set(STAND_DESK_COOKIE, tokenFor(role, secret), {
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

export function forbiddenForAEs(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Booth AEs can't do that — ask the stand admin." },
    { status: 403 },
  );
}
