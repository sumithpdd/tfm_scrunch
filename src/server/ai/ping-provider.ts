import "server-only";
import { generateText } from "ai";
import { modelIdFor, type AiRuntimeSettings } from "@/lib/ai-settings";
import { describeGenerationError, getModelFor } from "@/lib/gemini-config";

export async function pingAiProvider(settings: AiRuntimeSettings): Promise<{
  ok: boolean;
  model: string;
  sample?: string;
  error?: string;
}> {
  const model = modelIdFor(settings);
  try {
    const result = await generateText({
      model: getModelFor(settings),
      prompt: "Reply with the single word pong.",
    });
    const sample = (result.text ?? "").trim().slice(0, 80);
    return { ok: true, model, sample };
  } catch (err) {
    return { ok: false, model, error: describeGenerationError(err) };
  }
}
