import type { ScrunchBrandSetupDoc } from "@/lib/scrunch-setup-types";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Detailed Scrunch prompt CSV (Prompt Templates → Import prompts). */
export function scrunchPromptsToCsv(doc: ScrunchBrandSetupDoc): string {
  const header =
    "Prompt,Personas,Geos,Languages,Platforms,Topics,Tags,Stage,Favorite";
  const rows = doc.prompts.map((p) =>
    [
      csvCell(p.prompt),
      csvCell(p.personas),
      csvCell(p.geos),
      csvCell(p.languages),
      csvCell(p.platforms),
      csvCell(p.topics),
      csvCell(p.tags),
      csvCell(p.stage),
      csvCell("false"),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function slugSetupId(brandName: string): string {
  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "brand";
}

export function downloadScrunchPromptCsv(doc: ScrunchBrandSetupDoc): void {
  if (doc.prompts.length === 0) return;
  const csv = scrunchPromptsToCsv(doc);
  const filename = `${slugSetupId(doc.brandName || doc.website)}-prompts.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
