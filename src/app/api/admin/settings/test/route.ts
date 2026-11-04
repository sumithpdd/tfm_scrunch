import { NextRequest, NextResponse } from "next/server";
import {
  parseAiProvider,
  requireModelId,
  sanitizeAzureResource,
  sanitizeSecret,
  type AiRuntimeSettings,
} from "@/lib/ai-settings";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getRuntimeAiSettings } from "@/server/ai/runtime-settings";
import { pingAiProvider } from "@/server/ai/ping-provider";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  let body: Partial<AiRuntimeSettings> & { provider?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const saved = await getRuntimeAiSettings();
  const settings: AiRuntimeSettings = {
    provider: parseAiProvider(body.provider, saved.provider),
    azureDeployment: requireModelId(body.azureDeployment ?? saved.azureDeployment, "Azure deployment"),
    geminiModel: requireModelId(body.geminiModel ?? saved.geminiModel, "Gemini model"),
    azureApiKey: sanitizeSecret(body.azureApiKey) || saved.azureApiKey,
    azureResourceName: sanitizeAzureResource(body.azureResourceName, saved.azureResourceName),
    geminiApiKey: sanitizeSecret(body.geminiApiKey) || saved.geminiApiKey,
  };

  const result = await pingAiProvider(settings);
  return NextResponse.json(
    { success: result.ok, ...result },
    { status: result.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } },
  );
}
