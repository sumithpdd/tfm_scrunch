import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AUDIT_EVENTS_COLLECTION } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

export type AuditEventOutcome =
  | "blocked_rate"
  | "blocked_captcha"
  | "blocked_bot"
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

export type AuditEventRecord = {
  id: string;
  outcome: AuditEventOutcome;
  name: string;
  email: string;
  company: string;
  website: string;
  extraUrls: string[];
  error: string;
  durationMs: number | null;
  createdAt: string | null;
};

/** Most recent audit events (successes, failures, and blocked attempts), newest first. */
export async function listRecentAuditEvents(limit = 100): Promise<AuditEventRecord[]> {
  if (!isServerFirestoreAvailable()) return [];
  const snap = await getAdminDb()
    .collection(AUDIT_EVENTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 500))
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const createdAt = d.createdAt as { toDate?: () => Date } | undefined;
    return {
      id: doc.id,
      outcome: (d.outcome as AuditEventOutcome) ?? "failed",
      name: typeof d.name === "string" ? d.name : "",
      email: typeof d.email === "string" ? d.email : "",
      company: typeof d.company === "string" ? d.company : "",
      website: typeof d.website === "string" ? d.website : "",
      extraUrls: Array.isArray(d.extraUrls) ? (d.extraUrls as string[]) : [],
      error: typeof d.error === "string" ? d.error : "",
      durationMs: typeof d.durationMs === "number" ? d.durationMs : null,
      createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : null,
    };
  });
}
