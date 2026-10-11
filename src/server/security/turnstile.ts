import "server-only";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function isTurnstileRequired(): boolean {
  return isTurnstileConfigured();
}

export async function verifyTurnstileToken(
  token: string | undefined,
  ip: string,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true };

  const value = token?.trim() ?? "";
  if (!value) {
    return { ok: false, error: "Complete the captcha before running the audit." };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: value,
      remoteip: ip,
    });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      return { ok: false, error: "Captcha check failed. Refresh and try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Captcha could not be verified. Try again in a moment." };
  }
}
