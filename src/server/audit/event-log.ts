import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AUDIT_EVENTS_COLLECTION } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

export type AuditEventOutcome =
  | "blocked_rate"
  | "blocked_captcha"
  | "blocked_honeypot"
  | "blocked_validation"
  | "started"
  | "failed"
  | "completed";

export type AuditEventInput = {
  outcome: AuditEventOutcome;
  ip: string;
  userAgent?: string;
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  extraUrls?: string[];
  error?: string;
  durationMs?: number;
};

function hashIp(ip: string): string {
  const salt = process.env.AUDIT_LOG_SALT?.trim() || "tfm-scrunch-audit";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Best-effort write — never fail the visitor request. */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  if (!isServerFirestoreAvailable()) {
    console.info("[audit-event]", input.outcome, input.website || "", input.error || "");
    return;
  }
  try {
    await getAdminDb()
      .collection(AUDIT_EVENTS_COLLECTION)
      .add({
        outcome: input.outcome,
        ipHash: hashIp(input.ip),
        userAgent: (input.userAgent ?? "").slice(0, 240),
        name: (input.name ?? "").slice(0, 120),
        email: (input.email ?? "").trim().toLowerCase().slice(0, 160),
        company: (input.company ?? "").slice(0, 160),
        website: (input.website ?? "").slice(0, 300),
        extraUrls: (input.extraUrls ?? []).slice(0, 3),
        error: (input.error ?? "").slice(0, 400),
        durationMs: input.durationMs ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn("[audit-event] write failed", err);
  }
}
