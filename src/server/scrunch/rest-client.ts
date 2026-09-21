import "server-only";
import type {
  ScrunchLiveBrand,
  ScrunchLiveCompetitor,
  ScrunchLivePersona,
  ScrunchLivePrompt,
  ScrunchLiveSnapshot,
} from "@/lib/scrunch-live-types";

const BASE = "https://api.scrunchai.com/v1";

function token(): string | null {
  return process.env.SCRUNCH_API_TOKEN?.trim() || null;
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

async function scrunchFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const key = token();
  if (!key) throw new Error("SCRUNCH_API_TOKEN is not set");
  const method = init?.method || "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scrunch API ${res.status} ${method} ${path}: ${body.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function scrunchGet<T>(path: string): Promise<T> {
  return scrunchFetch<T>(path);
}

type Collection<T> = { total: number; items: T[] };

export function isScrunchApiConfigured(): boolean {
  return Boolean(token());
}

function emptySnapshot(message: string, configured: boolean): ScrunchLiveSnapshot {
  return {
    configured,
    message,
    brand: null,
    personas: [],
    competitors: [],
    prompts: [],
    promptTotal: 0,
    personaTotal: 0,
    competitorTotal: 0,
    topics: [],
  };
}

async function snapshotForBrand(
  brandId: number,
  orgId?: string,
): Promise<ScrunchLiveSnapshot> {
  const [brand, personas, competitors, prompts] = await Promise.all([
    scrunchGet<ScrunchLiveBrand>(`/brands/${brandId}`),
    scrunchGet<Collection<ScrunchLivePersona>>(`/brands/${brandId}/personas?limit=100`),
    scrunchGet<Collection<ScrunchLiveCompetitor>>(`/brands/${brandId}/competitors?limit=100`),
    scrunchGet<Collection<ScrunchLivePrompt>>(`/${brandId}/prompts?limit=100`),
  ]);

  const orgNote = orgId ? ` · org ${orgId.slice(0, 8)}…` : "";
  return {
    configured: true,
    message: `Connected to brand #${brand.id} — ${brand.name}${orgNote}`,
    brand,
    personas: personas.items,
    competitors: competitors.items,
    prompts: prompts.items,
    promptTotal: prompts.total,
    personaTotal: personas.total,
    competitorTotal: competitors.total,
    topics: brand.key_topics ?? [],
  };
}

export async function lookupScrunchLive(opts: {
  brandName: string;
  website: string;
  scrunchBrandId?: string;
  scrunchOrgId?: string;
}): Promise<ScrunchLiveSnapshot> {
  if (!token()) {
    return emptySnapshot(
      "Set SCRUNCH_API_TOKEN in .env.local (Scrunch org → API Keys, Query + Configure). MCP is for Cursor/Claude OAuth — the app uses the REST API at api.scrunchai.com.",
      false,
    );
  }

  const brandId = opts.scrunchBrandId?.trim();
  if (brandId) {
    try {
      return await snapshotForBrand(Number(brandId), opts.scrunchOrgId?.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return emptySnapshot(
        `Saved brand id did not resolve (${msg.slice(0, 120)}). Check the id or token org.`,
        true,
      );
    }
  }

  const brands = await scrunchGet<Collection<ScrunchLiveBrand>>("/brands?limit=100");
  const wantHost = hostOf(opts.website);
  const wantName = opts.brandName.trim().toLowerCase();
  const brand =
    brands.items.find((b) => hostOf(b.website) === wantHost) ||
    brands.items.find((b) => b.name.trim().toLowerCase() === wantName) ||
    brands.items.find(
      (b) => b.name.toLowerCase().includes(wantName) || wantName.includes(b.name.toLowerCase()),
    ) ||
    null;

  if (!brand) {
    return emptySnapshot(
      `No matching brand in this org (${brands.total} listed). Create in the wizard, then save org id + brand id here.`,
      true,
    );
  }

  return snapshotForBrand(brand.id, opts.scrunchOrgId?.trim());
}

export async function patchScrunchBrand(
  brandId: number,
  body: {
    description?: string;
    key_topics?: string[];
  },
): Promise<ScrunchLiveBrand> {
  return scrunchFetch<ScrunchLiveBrand>(`/brands/${brandId}`, { method: "PATCH", body });
}

export async function createScrunchPersona(
  brandId: number,
  persona: { name: string; description: string },
): Promise<ScrunchLivePersona> {
  return scrunchFetch<ScrunchLivePersona>(`/brands/${brandId}/personas`, {
    method: "POST",
    body: persona,
  });
}

export async function updateScrunchPersona(
  brandId: number,
  personaId: number,
  persona: { name: string; description: string },
): Promise<ScrunchLivePersona> {
  return scrunchFetch<ScrunchLivePersona>(`/brands/${brandId}/personas/${personaId}`, {
    method: "PUT",
    body: persona,
  });
}

export async function archiveScrunchPersona(brandId: number, personaId: number): Promise<void> {
  await scrunchFetch(`/brands/${brandId}/personas/${personaId}`, { method: "DELETE" });
}

export async function createScrunchCompetitor(
  brandId: number,
  competitor: {
    name: string;
    alternative_names?: string[];
    websites?: string[];
  },
): Promise<ScrunchLiveCompetitor> {
  return scrunchFetch<ScrunchLiveCompetitor>(`/brands/${brandId}/competitors`, {
    method: "POST",
    body: competitor,
  });
}

export async function archiveScrunchCompetitor(
  brandId: number,
  competitorId: number,
): Promise<void> {
  await scrunchFetch(`/brands/${brandId}/competitors/${competitorId}`, { method: "DELETE" });
}

function ensureHttpUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.toString();
  } catch {
    return undefined;
  }
}

export function competitorPayloadFromSheet(c: {
  name: string;
  altNames?: string;
  website?: string;
}): { name: string; alternative_names: string[]; websites: string[] } {
  const alternative_names = (c.altNames || "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const website = c.website ? ensureHttpUrl(c.website) : undefined;
  return {
    name: c.name.trim(),
    alternative_names,
    websites: website ? [website] : [],
  };
}
