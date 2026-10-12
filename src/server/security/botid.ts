import "server-only";
import { checkBotId } from "botid/server";

export async function verifyHumanRequest(): Promise<{ ok: boolean; error?: string }> {
  const verification = await checkBotId();
  if (verification.isBot) {
    return { ok: false, error: "This request looked automated. Reload the page and try again." };
  }
  return { ok: true };
}
