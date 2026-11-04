import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import {
  DEFAULT_AZURE_DEPLOYMENT,
  DEFAULT_GEMINI_MODEL,
  parseAiProvider,
  sanitizeAzureResource,
  sanitizeModelId,
  sanitizeSecret,
  type AiKeySource,
  type AiKeySources,
  type AiRuntimeSettings,
} from "@/lib/ai-settings";
import { SETTINGS_COLLECTION, SETTINGS_DOC_ID } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";

const CACHE_MS = 5_000;

export type StoredAiSettings = AiRuntimeSettings & {
  source: "firestore" | "env";
  updatedAt: string | null;
  keySource: AiKeySources;
};

export type AiKeyStatus = {
  azure: boolean;
  azureResource: boolean;
  gemini: boolean;
};

export type SaveAiSettingsInput = AiRuntimeSettings & {
  /** Empty string clears the Firestore override and falls back to env. */
  azureApiKey?: string;
  azureResourceName?: string;
  geminiApiKey?: string;
};

let cache: { value: StoredAiSettings; at: number } | null = null;

function serverEnv(name: string): string {
  return String((process.env as Record<string, string | undefined>)[name] ?? "").trim();
}

function pickSecret(stored: unknown, envValue: string): { value: string; source: AiKeySource } {
  const fromDb = sanitizeSecret(stored);
  if (fromDb) return { value: fromDb, source: "firestore" };
  if (envValue) return { value: envValue, source: "env" };
  return { value: "", source: "missing" };
}

export function envAiSettings(): AiRuntimeSettings {
  const raw = serverEnv("AI_PROVIDER").toLowerCase();
  return {
    provider: raw === "gemini" ? "gemini" : "azure",
    azureDeployment: serverEnv("AZURE_OPENAI_DEPLOYMENT") || DEFAULT_AZURE_DEPLOYMENT,
    geminiModel: serverEnv("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL,
    azureApiKey: serverEnv("AZURE_OPENAI_API_KEY"),
    azureResourceName: serverEnv("AZURE_OPENAI_RESOURCE_NAME"),
    geminiApiKey: serverEnv("GEMINI_API_KEY") || serverEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
  };
}

export function aiKeyStatus(settings?: AiRuntimeSettings): AiKeyStatus {
  const resolved = settings ?? envAiSettings();
  return {
    azure: Boolean(resolved.azureApiKey),
    azureResource: Boolean(resolved.azureResourceName),
    gemini: Boolean(resolved.geminiApiKey),
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

function mergeDoc(data: Record<string, unknown> | undefined, env: AiRuntimeSettings): StoredAiSettings {
  const azureApiKey = pickSecret(data?.azureApiKey, env.azureApiKey);
  const azureResourceName = pickSecret(data?.azureResourceName, env.azureResourceName);
  const geminiApiKey = pickSecret(data?.geminiApiKey, env.geminiApiKey);
  return {
    provider: parseAiProvider(data?.provider, env.provider),
    azureDeployment: sanitizeModelId(data?.azureDeployment, env.azureDeployment),
    geminiModel: sanitizeModelId(data?.geminiModel, env.geminiModel),
    azureApiKey: azureApiKey.value,
    azureResourceName: sanitizeAzureResource(azureResourceName.value, env.azureResourceName),
    geminiApiKey: geminiApiKey.value,
    source: data ? "firestore" : "env",
    updatedAt: null,
    keySource: {
      azureApiKey: azureApiKey.source,
      azureResourceName: azureResourceName.value ? azureResourceName.source : "missing",
      geminiApiKey: geminiApiKey.source,
    },
  };
}

async function readSettingsDoc(): Promise<{ data: Record<string, unknown>; updatedAt: string | null } | null> {
  if (!isServerFirestoreAvailable()) return null;
  const snap = await getAdminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return { data, updatedAt: isoFromTimestamp(data.updatedAt) };
}

function envStored(): StoredAiSettings {
  const env = envAiSettings();
  return {
    ...env,
    source: "env",
    updatedAt: null,
    keySource: {
      azureApiKey: env.azureApiKey ? "env" : "missing",
      azureResourceName: env.azureResourceName ? "env" : "missing",
      geminiApiKey: env.geminiApiKey ? "env" : "missing",
    },
  };
}

export async function getRuntimeAiSettings(): Promise<StoredAiSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const env = envAiSettings();
  try {
    const stored = await readSettingsDoc();
    const value = stored
      ? { ...mergeDoc(stored.data, env), source: "firestore" as const, updatedAt: stored.updatedAt }
      : envStored();
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("[ai-settings] Firestore read failed — using env defaults", err);
    const value = envStored();
    cache = { value, at: Date.now() };
    return value;
  }
}

function secretWrite(value: string | undefined): string | ReturnType<typeof FieldValue.delete> | undefined {
  if (value === undefined) return undefined;
  const next = sanitizeSecret(value);
  if (!next) return FieldValue.delete();
  return next;
}

export async function saveRuntimeAiSettings(input: SaveAiSettingsInput): Promise<StoredAiSettings> {
  if (!isServerFirestoreAvailable()) {
    throw new Error("Firestore is not configured, so settings cannot be saved from the admin UI.");
  }
  const env = envAiSettings();
  const nextModels = {
    provider: parseAiProvider(input.provider, env.provider),
    azureDeployment: sanitizeModelId(input.azureDeployment, env.azureDeployment),
    geminiModel: sanitizeModelId(input.geminiModel, env.geminiModel),
  };
  const azureResource =
    input.azureResourceName === undefined
      ? undefined
      : sanitizeAzureResource(input.azureResourceName, "") || FieldValue.delete();

  const payload: Record<string, unknown> = {
    provider: nextModels.provider,
    azureDeployment: nextModels.azureDeployment,
    geminiModel: nextModels.geminiModel,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const azureKey = secretWrite(input.azureApiKey);
  const geminiKey = secretWrite(input.geminiApiKey);
  if (azureKey !== undefined) payload.azureApiKey = azureKey;
  if (azureResource !== undefined) payload.azureResourceName = azureResource;
  if (geminiKey !== undefined) payload.geminiApiKey = geminiKey;

  await getAdminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).set(payload, { merge: true });
  invalidateRuntimeAiSettingsCache();
  return getRuntimeAiSettings();
}
