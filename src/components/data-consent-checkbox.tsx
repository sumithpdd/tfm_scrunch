"use client";

import { SITE } from "@/lib/site-config";

export function DataConsentCheckbox({
  checked,
  onChange,
  id = "data-consent",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-zinc-600">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-[#6e3fff]"
      />
      <span>{SITE.consentLabel}</span>
    </label>
  );
}
