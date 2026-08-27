import "server-only";
import { isSafePublicUrl } from "@/lib/url-safety";

const MAX_CHARS = 14000;

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(href).toString();
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch a public marketing homepage for the free AEO/GEO audit. SSRF-safe. */
export async function fetchPublicPageText(url: string): Promise<{ text: string; fetchedUrl: string; warning?: string }> {
  const href = normalizeHttpUrl(url);
  if (!href || !isSafePublicUrl(href)) {
    return { text: "", fetchedUrl: "", warning: "Website could not be fetched (blocked or invalid URL)." };
  }

  try {
    const res = await fetch(href, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "TFM-Scrunch-Audit/1.0",
      },
    });
    const finalUrl = res.url || href;
    if (!isSafePublicUrl(finalUrl)) {
      return { text: "", fetchedUrl: "", warning: "Website redirected to a blocked host." };
    }
    if (!res.ok) {
      return {
        text: "",
        fetchedUrl: finalUrl,
        warning: `Website returned HTTP ${res.status}. Research will use public knowledge only.`,
      };
    }
    const html = await res.text();
    const text = htmlToText(html).slice(0, MAX_CHARS);
    if (!text) {
      return { text: "", fetchedUrl: finalUrl, warning: "Homepage had no readable text." };
    }
    return { text, fetchedUrl: finalUrl };
  } catch {
    return {
      text: "",
      fetchedUrl: "",
      warning: "Website fetch timed out or failed. Research will use public knowledge only.",
    };
  }
}
