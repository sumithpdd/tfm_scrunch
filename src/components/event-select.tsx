"use client";

import { parseBoothEventCode, VISITOR_EVENTS, boothEventOptionLabel, type BoothEventCode } from "@/lib/booth-events";

export function EventSelect({
  value,
  onChange,
}: {
  value: BoothEventCode;
  onChange: (code: BoothEventCode) => void;
}) {
  return (
    <label className="block text-base font-medium text-zinc-700">
      Event
      <select
        className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20"
        value={value}
        onChange={(e) => onChange(parseBoothEventCode(e.target.value))}
      >
        {VISITOR_EVENTS.map((event) => (
          <option key={event.code} value={event.code}>
            {boothEventOptionLabel(event)}
          </option>
        ))}
      </select>
    </label>
  );
}
