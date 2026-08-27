import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { FieldValue, type DocumentData, type Timestamp } from "firebase-admin/firestore";
import type { AeoLead, MentionRateSnapshot, StoredBoothLead } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { LEADS_COLLECTION, LEGACY_LEADS_COLLECTION, TMF_EVENT_CODE } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

/**
 * Booth lead capture. Primary store is Firestore collection `tmf_scrunch_leads`
 * (same Firebase project as SitecoreAiDemoSenario). Documents are upserted by
 * email so a repeat visitor keeps `createdAt` and gets a fresh `updatedAt`.
 *
 * Local `data/leads.jsonl` is a booth-day fallback if Firebase is misconfigured.
 * Writes never fail the audit.
 */
export { LEADS_COLLECTION };

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "leads.jsonl");

export function leadDocId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, "_");
}

async function upsertFirestoreLead(
  lead: AeoLead,
  brandName: string,
  website: string,
  lastReport?: MentionRateSnapshot | null,
) {
  if (!isServerFirestoreAvailable()) {
    console.warn("[lead-log] Firestore not configured — skipping tmf_scrunch_leads write");
    return;
  }

  const email = lead.email.trim().toLowerCase();
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(leadDocId(email));
  const existing = await ref.get();
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      name: lead.name.trim(),
      company: lead.company.trim(),
      email,
      auditedBrand: brandName.trim(),
      auditedWebsite: website.trim(),
      eventCode: TMF_EVENT_CODE,
      eventName: SITE.eventName,
      consentAccepted: true,
      marketingUse: false,
      dataRetentionDays: SITE.dataRetentionDays,
      updatedAt: now,
      auditCount: FieldValue.increment(1),
      ...(existing.exists ? {} : { createdAt: now }),
      ...(existing.exists && existing.data()?.consentAt
        ? {}
        : {
            consentAt: now,
            retainUntil: new Date(
              Date.now() + SITE.dataRetentionDays * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
      ...(lastReport ? { lastReport } : {}),
    },
    { merge: true },
  );
}

async function appendLocalLead(lead: AeoLead, brandName: string, website: string) {
  await mkdir(LOG_DIR, { recursive: true });
  const at = new Date().toISOString();
  const row = {
    at,
    createdAt: at,
    updatedAt: at,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    auditedBrand: brandName,
    auditedWebsite: website,
    eventCode: TMF_EVENT_CODE,
    consentAccepted: true,
    marketingUse: false,
    dataRetentionDays: SITE.dataRetentionDays,
  };
  await appendFile(LOG_FILE, `${JSON.stringify(row)}\n`, "utf8");
}

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

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asSnapshot(value: unknown): MentionRateSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const citationPrompts = Array.isArray(data.citationPrompts)
    ? data.citationPrompts
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const prompt = String(row.prompt ?? "").trim();
          if (!prompt) return null;
          return { prompt, note: String(row.note ?? "") };
        })
        .filter((row): row is MentionRateSnapshot["citationPrompts"][number] => Boolean(row))
    : [];
  const mentionRates = Array.isArray(data.mentionRates)
    ? data.mentionRates
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const name = String(row.name ?? "").trim();
          if (!name) return null;
          return {
            name,
            website: String(row.website ?? ""),
            estimatedPct: asCount(row.estimatedPct),
            isAuditedBrand: Boolean(row.isAuditedBrand),
          };
        })
        .filter((row): row is MentionRateSnapshot["mentionRates"][number] => Boolean(row))
    : [];
  if (!citationPrompts.length && !mentionRates.length) return null;
  return {
    brandName: String(data.brandName ?? ""),
    website: String(data.website ?? ""),
    citationPrompts,
    mentionRates,
    generatedAt: String(data.generatedAt ?? ""),
  };
}

function mapLeadDoc(id: string, data: DocumentData): StoredBoothLead {
  return {
    id,
    name: String(data.name ?? ""),
    company: String(data.company ?? ""),
    email: String(data.email ?? ""),
    auditedBrand: String(data.auditedBrand ?? ""),
    auditedWebsite: String(data.auditedWebsite ?? ""),
    eventName: String(data.eventName ?? ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    auditCount: asCount(data.auditCount),
    lastReport: asSnapshot(data.lastReport),
  };
}

async function readLeadsFrom(collection: string): Promise<StoredBoothLead[]> {
  const snap = await getAdminDb().collection(collection).get();
  return snap.docs.map((doc) => mapLeadDoc(doc.id, doc.data()));
}

export async function listLeads(): Promise<StoredBoothLead[]> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }

  const byId = new Map<string, StoredBoothLead>();
  for (const lead of await readLeadsFrom(LEADS_COLLECTION)) {
    byId.set(lead.id, lead);
  }
  for (const lead of await readLeadsFrom(LEGACY_LEADS_COLLECTION)) {
    if (!byId.has(lead.id)) byId.set(lead.id, lead);
  }

  const leads = [...byId.values()];
  leads.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return leads;
}

export async function getLeadById(id: string): Promise<StoredBoothLead | null> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }
  const db = getAdminDb();
  const primary = await db.collection(LEADS_COLLECTION).doc(id).get();
  if (primary.exists) return mapLeadDoc(primary.id, primary.data() ?? {});
  const legacy = await db.collection(LEGACY_LEADS_COLLECTION).doc(id).get();
  if (legacy.exists) return mapLeadDoc(legacy.id, legacy.data() ?? {});
  return null;
}

export async function logLead(
  lead: AeoLead,
  brandName: string,
  website: string,
  lastReport?: MentionRateSnapshot | null,
) {
  try {
    await upsertFirestoreLead(lead, brandName, website, lastReport);
  } catch (err) {
    console.error("[lead-log] could not write tmf_scrunch_leads", err);
  }

  try {
    await appendLocalLead(lead, brandName, website);
  } catch (err) {
    console.error("[lead-log] could not write local leads.jsonl", err);
  }
}
