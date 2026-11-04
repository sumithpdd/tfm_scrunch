import { NextRequest, NextResponse } from "next/server";
import { AZURE_DEPLOYMENT_PRESETS, GEMINI_MODEL_PRESETS, parseAiProvider, requireModelId } from "@/lib/ai-settings";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import {
  aiKeyStatus,
  envAiSettings,
  getRuntimeAiSettings,
  saveRuntimeAiSettings,
} from "@/server/ai/runtime-settings";
import { isServerFirestoreAvailable } from "@/server/db/firestore-admin";

function payload(settings: Awaited<ReturnType<typeof getRuntimeAiSettings>>) {
  return {
    success: true,
    settings,
    keys: aiKeyStatus(),
    firestore: isServerFirestoreAvailable(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null,
    envFallback: envAiSettings(),
    presets: {
      azureDeployments: AZURE_DEPLOYMENT_PRESETS,
      geminiModels: GEMINI_MODEL_PRESETS,
    },
  };
}

export async function GET(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  const settings = await getRuntimeAiSettings();
  return NextResponse.json(payload(settings), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }
  if (role !== "super") return forbiddenForAEs();

  let body: { provider?: unknown; azureDeployment?: unknown; geminiModel?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  try {
    const settings = await saveRuntimeAiSettings({
      provider: parseAiProvider(body.provider),
      azureDeployment: requireModelId(body.azureDeployment, "Azure deployment"),
      geminiModel: requireModelId(body.geminiModel, "Gemini model"),
    });
    return NextResponse.json(payload(settings), { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
