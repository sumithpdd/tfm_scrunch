import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { FieldValue, type DocumentData, type Timestamp } from "firebase-admin/firestore";
import type { AeoLead, MentionRateSnapshot, StoredBoothLead } from "@/lib/audit-types";
import {
  type BoothEventCode,
  boothEventName,
  DEFAULT_BOOTH_EVENT,
  parseBoothEventCode,
} from "@/lib/booth-events";
import { SITE } from "@/lib/site-config";
import { LEADS_COLLECTION, LEGACY_LEADS_COLLECTION } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

/**
 * Booth lead capture. Primary store is Firestore collection `tmf_scrunch_leads`.
 * Documents are upserted by **website** so one visitor can run multiple brand
 * audits without overwriting earlier ones. Repeat runs on the same site keep
 * `createdAt` and refresh `updatedAt`.
 *
 * Local `data/leads.jsonl` is a booth-day fallback if Firebase is misconfigured.
 * Writes never fail the audit.
 */
export { LEADS_COLLECTION };

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "leads.jsonl");

export function matchHostFromUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/, "");
  }
}

/** Firestore doc id for a booth lead / report — one document per website. */
export function websiteDocId(website: string): string {
  const host = matchHostFromUrl(website);
  return (host || "unknown-site").replace(/\//g, "_");
}

/** TFM keeps the existing website id so current records stay put. Other events prefix the host. */
export function boothLeadDocId(website: string, eventCode: BoothEventCode = DEFAULT_BOOTH_EVENT): string {
  const host = websiteDocId(website);
  if (eventCode === "TFM") return host;
  return `${eventCode.toLowerCase()}_${host}`;
}

/** @deprecated Email was the old key. Kept to read leftover docs. */
export function leadDocId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, "_");
}

async function upsertFirestoreLead(
  lead: AeoLead,
  brandName: string,
  website: string,
  lastReport?: MentionRateSnapshot | null,
  eventCode: BoothEventCode = DEFAULT_BOOTH_EVENT,
) {
  if (!isServerFirestoreAvailable()) {
    console.warn("[lead-log] Firestore not configured — skipping tmf_scrunch_leads write");
    return;
  }

  const email = lead.email.trim().toLowerCase();
  const matchHost = matchHostFromUrl(website);
  const code = parseBoothEventCode(eventCode);
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(boothLeadDocId(website, code));
  const existing = await ref.get();
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      name: lead.name.trim(),
      company: lead.company.trim(),
      email,
      auditedBrand: brandName.trim(),
      auditedWebsite: website.trim(),
      matchHost,
      eventCode: code,
      eventName: boothEventName(code),
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
    eventCode: DEFAULT_BOOTH_EVENT,
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
    eventCode: parseBoothEventCode(String(data.eventCode ?? "")),
    eventName: String(data.eventName ?? boothEventName(parseBoothEventCode(String(data.eventCode ?? "")))),
    scrunchOrgId: String(data.scrunchOrgId ?? ""),
    scrunchBrandId: String(data.scrunchBrandId ?? ""),
    scrunchBrandName: String(data.scrunchBrandName ?? ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    auditCount: asCount(data.auditCount),
    lastReport: asSnapshot(data.lastReport),
    hasScrunchPdf: Boolean(data.hasScrunchPdf),
    scrunchPdfFilename: String(data.scrunchPdfFilename ?? ""),
    scrunchPdfUploadedAt: toIso(data.scrunchPdfUploadedAt) || String(data.scrunchPdfUploadedAt ?? ""),
    archived: Boolean(data.archived),
    reportHidden: Boolean(data.reportHidden),
  };
}

export function presentLeadForRole(
  lead: StoredBoothLead,
  role: "ae" | "super",
): StoredBoothLead | null {
  if (role === "ae" && lead.archived) return null;
  if (role === "ae" && lead.reportHidden) {
    return {
      ...lead,
      lastReport: null,
      hasScrunchPdf: false,
      scrunchPdfFilename: "",
      scrunchPdfUploadedAt: "",
    };
  }
  return lead;
}

async function readLeadsFrom(collection: string): Promise<StoredBoothLead[]> {
  const snap = await getAdminDb().collection(collection).get();
  return snap.docs.map((doc) => mapLeadDoc(doc.id, doc.data()));
}

export async function listLeads(): Promise<StoredBoothLead[]> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }

  await migrateUncodedLeadsToTfm();

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

export async function getLeadByWebsite(website: string): Promise<StoredBoothLead | null> {
  return getLeadById(websiteDocId(website));
}

async function migrateUncodedLeadsToTfm() {
  const snap = await getAdminDb().collection(LEADS_COLLECTION).get();
  const pending = snap.docs.filter((doc) => {
    const code = String(doc.data().eventCode ?? "").trim().toUpperCase();
    return code !== "TFM" && code !== "DMEXCO" && code !== "USERGROUP";
  });
  if (pending.length === 0) return;
  const db = getAdminDb();
  const patch = { eventCode: DEFAULT_BOOTH_EVENT, eventName: boothEventName(DEFAULT_BOOTH_EVENT) };
  for (let i = 0; i < pending.length; i += 400) {
    const batch = db.batch();
    for (const doc of pending.slice(i, i + 400)) {
      batch.set(doc.ref, patch, { merge: true });
    }
    await batch.commit();
  }
}

export async function saveScrunchIds(input: {
  id: string;
  orgId: string;
  brandId: string;
  brandName?: string;
}): Promise<StoredBoothLead> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(input.id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error("Company not found.");
  await ref.set(
    {
      scrunchOrgId: input.orgId.trim(),
      scrunchBrandId: input.brandId.trim(),
      scrunchBrandName: input.brandName?.trim() ?? existing.data()?.scrunchBrandName ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const saved = await getLeadById(input.id);
  if (!saved) throw new Error("Could not save Scrunch ids.");
  return saved;
}

export async function upsertCompanyRecord(input: {
  company: string;
  website: string;
  name?: string;
  email?: string;
  eventCode?: string;
  scrunchOrgId?: string;
  scrunchBrandId?: string;
  scrunchPdf?: { filename: string; storagePath: string };
}): Promise<StoredBoothLead> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }

  const website = input.website.trim();
  const company = input.company.trim();
  if (!website || !company) {
    throw new Error("Company and website are required.");
  }

  const eventCode = parseBoothEventCode(input.eventCode);
  const id = boothLeadDocId(website, eventCode);
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(id);
  const existing = await ref.get();
  const now = FieldValue.serverTimestamp();
  const uploadedAt = new Date().toISOString();

  await ref.set(
    {
      company,
      auditedBrand: company,
      auditedWebsite: website,
      matchHost: matchHostFromUrl(website),
      eventCode,
      eventName: boothEventName(eventCode),
      ...(input.scrunchOrgId?.trim() ? { scrunchOrgId: input.scrunchOrgId.trim() } : {}),
      ...(input.scrunchBrandId?.trim() ? { scrunchBrandId: input.scrunchBrandId.trim() } : {}),
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now, auditCount: 0 }),
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.scrunchPdf
        ? {
            hasScrunchPdf: true,
            scrunchPdfFilename: input.scrunchPdf.filename,
            scrunchPdfStoragePath: input.scrunchPdf.storagePath,
            scrunchPdfUploadedAt: uploadedAt,
          }
        : {}),
    },
    { merge: true },
  );

  const saved = await getLeadById(id);
  if (!saved) throw new Error("Could not save company record.");
  return saved;
}

export async function setLeadModeration(input: {
  id: string;
  archived?: boolean;
  reportHidden?: boolean;
}): Promise<StoredBoothLead> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(input.id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error("Company not found.");
  const now = FieldValue.serverTimestamp();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.archived !== undefined) {
    patch.archived = input.archived;
    patch.archivedAt = input.archived ? now : FieldValue.delete();
  }
  if (input.reportHidden !== undefined) {
    patch.reportHidden = input.reportHidden;
    patch.reportHiddenAt = input.reportHidden ? now : FieldValue.delete();
  }
  await ref.set(patch, { merge: true });
  const saved = await getLeadById(input.id);
  if (!saved) throw new Error("Could not update company.");
  return saved;
}

export async function removeLead(id: string): Promise<void> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured");
  }
  const ref = getAdminDb().collection(LEADS_COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new Error("Company not found.");
  await ref.delete();
}

export async function logLead(
  lead: AeoLead,
  brandName: string,
  website: string,
  lastReport?: MentionRateSnapshot | null,
  eventCode: BoothEventCode = DEFAULT_BOOTH_EVENT,
) {
  try {
    await upsertFirestoreLead(lead, brandName, website, lastReport, eventCode);
  } catch (err) {
    console.error("[lead-log] could not write tmf_scrunch_leads", err);
  }

  try {
    await appendLocalLead(lead, brandName, website);
  } catch (err) {
    console.error("[lead-log] could not write local leads.jsonl", err);
  }
}
