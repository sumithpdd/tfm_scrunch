import "server-only";
/**
 * Model/provider factory for the booth audit + Scrunch brand-setup generation.
 *
 * Live switch lives in Firestore `tmf_scrunch_settings/app` (stand-desk Settings, super admin),
 * including optional API key overrides. Env vars are the fallback.
 */
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ZodError } from "zod";
import { modelIdFor, type AiProviderName, type AiRuntimeSettings } from "@/lib/ai-settings";
import { getRuntimeAiSettings } from "@/server/ai/runtime-settings";

export type { AiProviderName } from "@/lib/ai-settings";

function serverEnv(name: string): string {
  // Dynamic lookup so Next.js does not inline the value at build time.
  return String((process.env as Record<string, string | undefined>)[name] ?? "").trim();
}

let azureSingleton: ReturnType<typeof createAzure> | null = null;
let azureSingletonKey = "";
let geminiSingleton: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let geminiSingletonKey = "";

function getAzureProvider(apiKey: string, resourceName: string) {
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not configured");
  if (!resourceName) throw new Error("AZURE_OPENAI_RESOURCE_NAME is not configured");
  const fingerprint = `${apiKey}:${resourceName}`;
  if (!azureSingleton || azureSingletonKey !== fingerprint) {
    azureSingletonKey = fingerprint;
    azureSingleton = createAzure({
      apiKey,
      resourceName,
      apiVersion: serverEnv("AZURE_OPENAI_API_VERSION") || undefined,
    });
  }
  return azureSingleton;
}

function getGeminiProvider(apiKey: string) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  if (!geminiSingleton || geminiSingletonKey !== apiKey) {
    geminiSingletonKey = apiKey;
    geminiSingleton = createGoogleGenerativeAI({ apiKey });
  }
  return geminiSingleton;
}

export function getModelFor(settings: AiRuntimeSettings) {
  if (settings.provider === "gemini") {
    return getGeminiProvider(settings.geminiApiKey)(settings.geminiModel);
  }
  return getAzureProvider(settings.azureApiKey, settings.azureResourceName)(settings.azureDeployment);
}

export async function getModel() {
  return getModelFor(await getRuntimeAiSettings());
}

export async function getActiveProviderName(): Promise<AiProviderName> {
  return (await getRuntimeAiSettings()).provider;
}

export async function getGeminiModelId(): Promise<string> {
  return modelIdFor(await getRuntimeAiSettings());
}

/**
 * A failed schema .parse() throws a ZodError whose default .message is the raw issues array
 * as JSON (e.g. `[{"expected":"string","code":"invalid_type","path":["brandName"],...}]`).
 * That's what generateObject/generateText + .parse() were surfacing straight to the booth UI.
 * Describe it in a sentence instead, and pass anything else through untouched.
 */
export function describeGenerationError(err: unknown): string {
  if (err instanceof ZodError) {
    const fields = [...new Set(err.issues.map((i) => i.path.join(".")).filter(Boolean))];
    return fields.length
      ? `response didn't match the expected format (missing or invalid: ${fields.join(", ")})`
      : "response didn't match the expected format";
  }
  return err instanceof Error ? err.message : String(err);
}

export function formatGeminiError(err: unknown, provider?: AiProviderName): string {
  const raw = describeGenerationError(err);
  const active = provider ?? "azure";

  if (active === "azure") {
    if (raw.includes("AZURE_OPENAI_API_KEY") || raw.includes("AZURE_OPENAI_RESOURCE_NAME")) {
      return (
        "Azure OpenAI isn't configured. Add AZURE_OPENAI_API_KEY and AZURE_OPENAI_RESOURCE_NAME " +
        "to .env.local / Vercel, then pick the deployment name in Stand desk → Settings."
      );
    }
    if (raw.includes("429") || /rate limit/i.test(raw)) {
      return (
        "Azure OpenAI rate limit hit (the deployment's tokens-per-minute cap). " +
        "Wait a minute and retry, or switch to Gemini in Stand desk → Settings."
      );
    }
    if (raw.includes("401") || raw.includes("DeploymentNotFound") || /unauthorized/i.test(raw)) {
      return (
        "Azure OpenAI rejected the request. Check AZURE_OPENAI_API_KEY is current, and that " +
        "the deployment name in Settings exactly matches a deployment in Azure AI Foundry."
      );
    }
    return raw;
  }

  if (raw.includes("GEMINI_API_KEY")) {
    return (
      "Gemini isn't configured. Add GEMINI_API_KEY to .env.local / Vercel (see Stand desk → Settings), " +
      "or switch the provider back to Azure OpenAI."
    );
  }
  if (raw.includes("429") || /rate limit|quota/i.test(raw)) {
    return (
      "Gemini rate limit or quota hit. Wait a bit and retry, or switch to Azure OpenAI in " +
      "Stand desk → Settings."
    );
  }
  if (raw.includes("401") || raw.includes("403") || /unauthorized|permission/i.test(raw)) {
    return "Gemini rejected the request. Check GEMINI_API_KEY is current and has not expired.";
  }
  return raw;
}
