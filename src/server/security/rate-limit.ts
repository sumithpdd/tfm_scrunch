import "server-only";

type Bucket = { times: number[] };

const buckets = new Map<string, Bucket>();

function prune(times: number[], now: number, windowMs: number): number[] {
  return times.filter((t) => now - t < windowMs);
}

/** In-process sliding window. Resets on deploy — good enough with Turnstile in front. */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key) ?? { times: [] };
  const recent = prune(current.times, now, windowMs);
  recent.push(now);
  buckets.set(key, { times: recent });
  return recent.length > limit;
}

export function clientIp(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "local";
}

export function userAgent(request: { headers: Headers }): string {
  return (request.headers.get("user-agent") ?? "").slice(0, 240);
}
