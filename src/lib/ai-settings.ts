export const AI_PROVIDERS = ["azure", "gemini"] as const;

export type AiProviderName = (typeof AI_PROVIDERS)[number];

export type AiKeySource = "firestore" | "env" | "missing";

export type AiRuntimeSettings = {
  provider: AiProviderName;
  azureDeployment: string;
  geminiModel: string;
  azureApiKey: string;
  azureResourceName: string;
  geminiApiKey: string;
};

export type AiKeySources = {
  azureApiKey: AiKeySource;
  azureResourceName: AiKeySource;
  geminiApiKey: AiKeySource;
};

export const DEFAULT_AZURE_DEPLOYMENT = "gpt-4o";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const AZURE_DEPLOYMENT_PRESETS = [
  { id: "gpt-4o", label: "gpt-4o" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini" },
  { id: "gpt-4.1", label: "gpt-4.1" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
] as const;

export const GEMINI_MODEL_PRESETS = [
  { id: "gemini-3.8-flash", label: "gemini-3.8-flash" },
  { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
  { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
] as const;

export function isAiProviderName(value: unknown): value is AiProviderName {
  return value === "azure" || value === "gemini";
}

export function parseAiProvider(value: unknown, fallback: AiProviderName = "azure"): AiProviderName {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "gemini" ? "gemini" : raw === "azure" ? "azure" : fallback;
}

/** Azure deployment names and Gemini model ids: letters, digits, . _ : - */
export function sanitizeModelId(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 80) return fallback;
  if (!/^[a-zA-Z0-9._:-]+$/.test(raw)) return fallback;
  return raw;
}

export function requireModelId(value: unknown, field: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${field} is required.`);
  if (raw.length > 80 || !/^[a-zA-Z0-9._:-]+$/.test(raw)) {
    throw new Error(`${field} can only contain letters, numbers, dots, underscores, colons, and hyphens.`);
  }
  return raw;
}

export function sanitizeSecret(value: unknown, max = 256): string {
  return String(value ?? "").replace(/[\r\n\u0000]/g, "").trim().slice(0, max);
}

export function sanitizeAzureResource(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (raw.length > 80 || !/^[a-zA-Z0-9-]+$/.test(raw)) return fallback;
  return raw;
}

export function modelIdFor(settings: AiRuntimeSettings): string {
  return settings.provider === "gemini"
    ? `gemini:${settings.geminiModel}`
    : `azure:${settings.azureDeployment}`;
}
