export const BOOTH_EVENT_CODES = ["TFM", "DMEXCO", "USERGROUP"] as const;

export type BoothEventCode = (typeof BOOTH_EVENT_CODES)[number];

export const BOOTH_EVENTS: {
  code: BoothEventCode;
  label: string;
  name: string;
}[] = [
  { code: "TFM", label: "TFM", name: "Technology for Marketing 2026" },
  { code: "DMEXCO", label: "DMEXCO", name: "DMEXCO" },
  { code: "USERGROUP", label: "Usergroup", name: "Sitecore User Group" },
];

export const DEFAULT_BOOTH_EVENT: BoothEventCode = "TFM";

export function isBoothEventCode(value: string | undefined | null): value is BoothEventCode {
  return BOOTH_EVENT_CODES.includes((value ?? "") as BoothEventCode);
}

export function parseBoothEventCode(value: string | undefined | null): BoothEventCode {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "TMF") return "TFM";
  if (isBoothEventCode(raw)) return raw;
  return DEFAULT_BOOTH_EVENT;
}

export function boothEventName(code: BoothEventCode): string {
  return BOOTH_EVENTS.find((event) => event.code === code)?.name ?? code;
}
