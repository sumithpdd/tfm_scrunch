const SCRUNCH_APP = "https://app.scrunchai.com";

/** Live brand dashboard: /org/{orgId}/b/{brandId}/dashboard */
export function scrunchDashboardUrl(orgId: string, brandId: string): string | null {
  const org = orgId.trim();
  const brand = brandId.trim();
  if (!org || !brand) return null;
  return `${SCRUNCH_APP}/org/${encodeURIComponent(org)}/b/${encodeURIComponent(brand)}/dashboard`;
}

export function parseScrunchDashboardUrl(value: string): { orgId: string; brandId: string } | null {
  const match = value.trim().match(/app\.scrunchai\.com\/org\/([^/?#]+)\/b\/([^/?#]+)/i);
  if (!match) return null;
  return {
    orgId: decodeURIComponent(match[1]),
    brandId: decodeURIComponent(match[2]),
  };
}
