export const BOOTH_EVENT_CODES = [
  "MARTECH",
  "NOV24",
  "PUBLIC",
  "TFM",
  "DMEXCO",
  "USERGROUP",
] as const;

export type BoothEventCode = (typeof BOOTH_EVENT_CODES)[number];

export type BoothEvent = {
  code: BoothEventCode;
  label: string;
  name: string;
  dates?: string;
  /** Shown on the public audit form. Historical booths stay on stand desk only. */
  visitor: boolean;
};

export const BOOTH_EVENTS: BoothEvent[] = [
  {
    code: "MARTECH",
    label: "MarTech Summit",
    name: "The MarTech Summit London",
    dates: "10–11 November 2026",
    visitor: true,
  },
  {
    code: "NOV24",
    label: "24–25 Nov",
    name: "24–25 November",
    dates: "24–25 November 2026",
    visitor: true,
  },
  {
    code: "PUBLIC",
    label: "Outside event",
    name: "Not at an event",
    visitor: true,
  },
  { code: "TFM", label: "TFM", name: "Technology for Marketing 2026", visitor: false },
  { code: "DMEXCO", label: "DMEXCO", name: "DMEXCO", visitor: false },
  { code: "USERGROUP", label: "Usergroup", name: "Sitecore User Group", visitor: false },
];

export const VISITOR_EVENTS = BOOTH_EVENTS.filter((event) => event.visitor);

export const DEFAULT_BOOTH_EVENT: BoothEventCode = "MARTECH";

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

export function boothEventOptionLabel(event: BoothEvent): string {
  return event.dates ? `${event.name} — ${event.dates}` : event.name;
}
