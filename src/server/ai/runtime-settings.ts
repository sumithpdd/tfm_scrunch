import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import {
  DEFAULT_AZURE_DEPLOYMENT,
  DEFAULT_GEMINI_MODEL,
  parseAiProvider,
  sanitizeModelId,
  type AiRuntimeSettings,
} from "@/lib/ai-settings";
import { SETTINGS_COLLECTION, SETTINGS_DOC_ID } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

const CACHE_MS = 10_000;

export type StoredAiSettings = AiRuntimeSettings & {
  source: "firestore" | "env";
  updatedAt: string | null;
};

export type AiKeyStatus = {
  azure: boolean;
  azureResource: boolean;
  gemini: boolean;
};

let cache: { value: StoredAiSettings; at: number } | null = null;

export function envAiSettings(): AiRuntimeSettings {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  return {
    provider: raw === "gemini" ? "gemini" : "azure",
    azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || DEFAULT_AZURE_DEPLOYMENT,
    geminiModel: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  };
}

export function aiKeyStatus(): AiKeyStatus {
  return {
    azure: Boolean(process.env.AZURE_OPENAI_API_KEY?.trim()),
    azureResource: Boolean(process.env.AZURE_OPENAI_RESOURCE_NAME?.trim()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
}

export function invalidateRuntimeAiSettingsCache() {
  cache = null;
}

function isoFromTimestamp(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      return (value as Timestamp).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function mergeDoc(data: Record<string, unknown> | undefined, env: AiRuntimeSettings): AiRuntimeSettings {
  return {
    provider: parseAiProvider(data?.provider, env.provider),
    azureDeployment: sanitizeModelId(data?.azureDeployment, env.azureDeployment),
    geminiModel: sanitizeModelId(data?.geminiModel, env.geminiModel),
  };
}

async function readSettingsDoc(): Promise<{ data: Record<string, unknown>; updatedAt: string | null } | null> {
  if (!isServerFirestoreAvailable()) return null;
  const snap = await getAdminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return { data, updatedAt: isoFromTimestamp(data.updatedAt) };
}

export async function getRuntimeAiSettings(): Promise<StoredAiSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const env = envAiSettings();
  try {
    const stored = await readSettingsDoc();
    const value: StoredAiSettings = stored
      ? { ...mergeDoc(stored.data, env), source: "firestore", updatedAt: stored.updatedAt }
      : { ...env, source: "env", updatedAt: null };
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("[ai-settings] Firestore read failed — using env defaults", err);
    const value: StoredAiSettings = { ...env, source: "env", updatedAt: null };
    cache = { value, at: Date.now() };
    return value;
  }
}

export async function saveRuntimeAiSettings(input: AiRuntimeSettings): Promise<StoredAiSettings> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured, so settings cannot be saved from the admin UI.");
  }
  const env = envAiSettings();
  const next: AiRuntimeSettings = {
    provider: parseAiProvider(input.provider, env.provider),
    azureDeployment: sanitizeModelId(input.azureDeployment, env.azureDeployment),
    geminiModel: sanitizeModelId(input.geminiModel, env.geminiModel),
  };
  await getAdminDb()
    .collection(SETTINGS_COLLECTION)
    .doc(SETTINGS_DOC_ID)
    .set(
      {
        provider: next.provider,
        azureDeployment: next.azureDeployment,
        geminiModel: next.geminiModel,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  invalidateRuntimeAiSettingsCache();
  return { ...next, source: "firestore", updatedAt: new Date().toISOString() };
}
