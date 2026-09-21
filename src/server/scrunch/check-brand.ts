import "server-only";
import type { ScrunchBrandCheck } from "@/lib/audit-types";

export type { ScrunchBrandCheck };

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

type ScrunchBrand = { id: number; name: string; website?: string };
type Collection<T> = { total: number; items: T[] };

async function scrunchGet<T>(path: string): Promise<T> {
  const key = token();
  if (!key) throw new Error("SCRUNCH_API_TOKEN is not set");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scrunch API ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

export function isScrunchApiConfigured(): boolean {
  return Boolean(token());
}

export async function checkScrunchBrand(input: {
  company?: string;
  website?: string;
  orgId?: string;
  brandId?: string;
}): Promise<ScrunchBrandCheck> {
  const orgId = input.orgId?.trim() ?? "";
  if (!token()) {
    return {
      configured: false,
      found: false,
      orgId,
      brandId: "",
      brandName: "",
      website: "",
      message: "SCRUNCH_API_TOKEN is not set — add it to check brands in Scrunch.",
    };
  }

  const brandId = input.brandId?.trim() ?? "";
  if (brandId) {
    const brand = await scrunchGet<ScrunchBrand>(`/brands/${brandId}`);
    return {
      configured: true,
      found: true,
      orgId,
      brandId: String(brand.id),
      brandName: brand.name,
      website: brand.website ?? "",
      message: `Found in Scrunch: ${brand.name} (#${brand.id}).`,
    };
  }

  const brands = await scrunchGet<Collection<ScrunchBrand>>("/brands?limit=100");
  const wantHost = hostOf(input.website ?? "");
  const wantName = (input.company ?? "").trim().toLowerCase();
  const brand =
    brands.items.find((item) => hostOf(item.website ?? "") === wantHost) ||
    brands.items.find((item) => item.name.trim().toLowerCase() === wantName) ||
    null;

  if (!brand) {
    return {
      configured: true,
      found: false,
      orgId,
      brandId: "",
      brandName: "",
      website: "",
      message: `Not in this Scrunch org (${brands.total} brands listed). Paste org id + brand id if you have them.`,
    };
  }

  return {
    configured: true,
    found: true,
    orgId,
    brandId: String(brand.id),
    brandName: brand.name,
    website: brand.website ?? "",
    message: `Matched ${brand.name} (#${brand.id}) in Scrunch.`,
  };
}
