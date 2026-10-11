export type AuditStageId =
  | "validate"
  | "read_site"
  | "read_extra"
  | "research"
  | "compare"
  | "write"
  | "save"
  | "done";

export type AuditStageEvent = {
  type: "stage";
  id: AuditStageId;
  label: string;
  detail?: string;
};

export type AuditDoneEvent = {
  type: "done";
  report: unknown;
};

export type AuditErrorEvent = {
  type: "error";
  error: string;
};

export type AuditStreamEvent = AuditStageEvent | AuditDoneEvent | AuditErrorEvent;

export const AUDIT_STAGE_ORDER: { id: AuditStageId; label: string }[] = [
  { id: "validate", label: "Checking your details" },
  { id: "read_site", label: "Reading your homepage" },
  { id: "read_extra", label: "Reading extra pages you added" },
  { id: "research", label: "Researching how AI would describe you" },
  { id: "compare", label: "Comparing you with brands AI names nearby" },
  { id: "write", label: "Writing your visibility brief" },
  { id: "save", label: "Saving your audit" },
  { id: "done", label: "Ready" },
];

export function parseExtraUrls(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join("\n") : (raw ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/[\n,]+/)) {
    const value = line.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 3) break;
  }
  return out;
}
