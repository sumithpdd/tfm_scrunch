/**
 * Model/provider config for the booth audit + Scrunch brand-setup generation.
 *
 * Supports two providers side by side:
 *   - "azure"  -> org IT AI sandbox (SitecoreOpenAI-Sandbox-ET) -- the default, since it's
 *                 funded right now
 *   - "gemini" -> Google AI Studio -- the original engine, kept wired up so we can flip back
 *                 the moment Gemini credits are topped up
 *
 * Toggle with AI_PROVIDER=azure|gemini in .env.local. Unset or anything else = "azure".
 *
 * Function names kept as `*Gemini*` on purpose -- they're imported from several files (see
 * AGENTS.md) and a rename wasn't worth the blast radius for what's really a provider toggle.
 * They now resolve whichever provider is active.
 */
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AiProviderName = "azure" | "gemini";

export function getActiveProviderName(): AiProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  return raw === "gemini" ? "gemini" : "azure";
}

function getAzureDeploymentName(): string {
  // The "model id" passed to the SDK provider for Azure OpenAI is the *deployment name*
  // chosen in Azure AI Foundry (e.g. "gpt-4o"), not a base model family name.
  return process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || "gpt-4o";
}

function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

let azureSingleton: ReturnType<typeof createAzure> | null = null;
let geminiSingleton: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getAzureProvider() {
  if (!azureSingleton) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
    if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not configured");
    if (!resourceName) throw new Error("AZURE_OPENAI_RESOURCE_NAME is not configured");
    azureSingleton = createAzure({
      apiKey,
      resourceName,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() || undefined,
    });
  }
  return azureSingleton;
}

function getGeminiProvider() {
  if (!geminiSingleton) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    geminiSingleton = createGoogleGenerativeAI({ apiKey });
  }
  return geminiSingleton;
}

/** The AI SDK language model for whichever provider AI_PROVIDER currently selects. */
export function getModel() {
  if (getActiveProviderName() === "gemini") {
    return getGeminiProvider()(getGeminiModelName());
  }
  return getAzureProvider()(getAzureDeploymentName());
}

/** Display/label id for usage tracking + UI, e.g. "azure:gpt-4o" or "gemini:gemini-3.8-flash". */
export function getGeminiModelId(): string {
  return getActiveProviderName() === "gemini"
    ? `gemini:${getGeminiModelName()}`
    : `azure:${getAzureDeploymentName()}`;
}

export function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const provider = getActiveProviderName();

  if (provider === "azure") {
    if (raw.includes("AZURE_OPENAI_API_KEY") || raw.includes("AZURE_OPENAI_RESOURCE_NAME")) {
      return (
        "Azure OpenAI isn't configured. Add AZURE_OPENAI_API_KEY, AZURE_OPENAI_RESOURCE_NAME, " +
        "and AZURE_OPENAI_DEPLOYMENT to .env.local (see .env.example) and restart the dev server."
      );
    }
    if (raw.includes("429") || /rate limit/i.test(raw)) {
      return (
        "Azure OpenAI rate limit hit (the deployment's tokens-per-minute cap). " +
        "Wait a minute and retry, or raise the deployment's quota in Azure AI Foundry -> " +
        "Deployments -> (your deployment) -> Edit, or switch AI_PROVIDER=gemini in .env.local."
      );
    }
    if (raw.includes("401") || raw.includes("DeploymentNotFound") || /unauthorized/i.test(raw)) {
      return (
        "Azure OpenAI rejected the request. Check AZURE_OPENAI_API_KEY is current, and that " +
        "AZURE_OPENAI_DEPLOYMENT exactly matches a deployment name that exists in the resource."
      );
    }
    return raw;
  }

  // Gemini
  if (raw.includes("GEMINI_API_KEY")) {
    return (
      "Gemini isn't configured. Add GEMINI_API_KEY to .env.local (see .env.example), or " +
      "switch AI_PROVIDER=azure to use the Azure sandbox instead."
    );
  }
  if (raw.includes("429") || /rate limit|quota/i.test(raw)) {
    return (
      "Gemini rate limit or quota hit. Wait a bit and retry, or set AI_PROVIDER=azure in " +
      ".env.local to switch to the Azure sandbox."
    );
  }
  if (raw.includes("401") || raw.includes("403") || /unauthorized|permission/i.test(raw)) {
    return "Gemini rejected the request. Check GEMINI_API_KEY is current and has not expired.";
  }
  return raw;
}
