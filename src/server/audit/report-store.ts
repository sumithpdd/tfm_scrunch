import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { AeoAuditReport, AeoLead, StoredVisibilityReport } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { LEGACY_REPORTS_COLLECTION, REPORTS_COLLECTION, TMF_EVENT_CODE } from "@/lib/tmf-store";
import { pdfInputFromReport, reportPdfBase64, reportPdfFilename } from "@/lib/report-pdf";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";
import { leadDocId } from "@/server/audit/lead-log";

export { REPORTS_COLLECTION };

function toIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as Timestamp).toDate().toISOString();
    } catch {
      return "";
    }
  }
  return "";
}

function mapReport(id: string, data: Record<string, unknown>, emailFallback: string): StoredVisibilityReport | null {
  const visibility = data.visibility as StoredVisibilityReport["visibility"] | undefined;
  if (!visibility) return null;
  return {
    id,
    email: String(data.email ?? emailFallback),
    name: String(data.name ?? ""),
    company: String(data.company ?? ""),
    brandName: String(data.brandName ?? ""),
    website: String(data.website ?? ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    visibility,
    citationPrompts: Array.isArray(data.citationPrompts) ? data.citationPrompts : [],
    mentionRates: Array.isArray(data.mentionRates) ? data.mentionRates : [],
  };
}

export async function saveVisibilityReport(input: {
  lead: AeoLead;
  brandName: string;
  website: string;
  report: AeoAuditReport;
}) {
  if (!isServerFirestoreAvailable()) {
    console.warn("[report-store] Firestore not configured — skipping tmf_scrunch_reports write");
    return;
  }

  const email = input.lead.email.trim().toLowerCase();
  const ref = getAdminDb().collection(REPORTS_COLLECTION).doc(leadDocId(email));
  const existing = await ref.get();
  const now = FieldValue.serverTimestamp();
  const pdfFilename = reportPdfFilename(input.report.brandName || input.brandName);

  let pdfBase64 = "";
  try {
    pdfBase64 = reportPdfBase64(pdfInputFromReport(input.report, input.lead));
  } catch (err) {
    console.warn("[report-store] could not build PDF for tmf_scrunch_reports", err);
  }

  const payload: Record<string, unknown> = {
    email,
    name: input.lead.name.trim(),
    company: input.lead.company.trim(),
    brandName: input.brandName.trim(),
    website: input.website.trim(),
    eventCode: TMF_EVENT_CODE,
    eventName: SITE.eventName,
    visibility: input.report.visibility,
    citationPrompts: input.report.citationPrompts,
    mentionRates: input.report.mentionRates,
    source: input.report.source,
    pdfFilename,
    updatedAt: now,
    ...(existing.exists ? {} : { createdAt: now }),
  };
  if (pdfBase64) payload.pdfBase64 = pdfBase64;

  try {
    await ref.set(payload, { merge: true });
  } catch (err) {
    if (!pdfBase64) throw err;
    console.warn("[report-store] write with PDF failed — retrying without pdfBase64", err);
    delete payload.pdfBase64;
    await ref.set(payload, { merge: true });
  }
}

export async function getVisibilityReportByEmail(email: string): Promise<StoredVisibilityReport | null> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }
  const id = leadDocId(email);
  const db = getAdminDb();
  const primary = await db.collection(REPORTS_COLLECTION).doc(id).get();
  if (primary.exists) {
    return mapReport(primary.id, (primary.data() ?? {}) as Record<string, unknown>, email);
  }
  const legacy = await db.collection(LEGACY_REPORTS_COLLECTION).doc(id).get();
  if (legacy.exists) {
    return mapReport(legacy.id, (legacy.data() ?? {}) as Record<string, unknown>, email);
  }
  return null;
}
