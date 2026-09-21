"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOTH_EVENTS, DEFAULT_BOOTH_EVENT, type BoothEventCode } from "@/lib/booth-events";
import { SITE } from "@/lib/site-config";
import { DataConsentCheckbox } from "@/components/data-consent-checkbox";

export function LeadCaptureHero() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState<string>(SITE.defaultVisitorEmail);
  const [website, setWebsite] = useState("");
  const [eventCode, setEventCode] = useState<BoothEventCode>(DEFAULT_BOOTH_EVENT);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !company.trim() || !email.trim() || !website.trim()) {
      setError("Fill in all four fields to run your free audit.");
      return;
    }
    if (!consentAccepted) {
      setError(SITE.consentLabel);
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      website: website.trim(),
      event: eventCode,
      consent: "1",
      autorun: "1",
    });
    router.push(`/audit?${params.toString()}`);
  }

  return (
    <section className="grid gap-10 overflow-hidden rounded-[1.75rem] border border-[#ece4ff] bg-white shadow-[0_30px_80px_-48px_rgba(67,0,173,0.45)] lg:grid-cols-2">
      <div className="p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">
          {SITE.tagline}
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#212121] sm:text-5xl">
          {SITE.heroHeadline}
          <br />
          <span className="bg-gradient-to-r from-[#6e3fff] to-[#EB001A] bg-clip-text text-transparent">
            {SITE.heroHeadlineEmphasis}
          </span>
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-zinc-600">{SITE.heroSubcopy}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" value={name} onChange={setName} placeholder="Jamie Smith" />
            <Field label="Company" value={company} onChange={setCompany} placeholder="Acme Inc" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Work email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={SITE.defaultVisitorEmail}
              hint="Leave this if you prefer not to share yours. Change it after the audit if you want the PDF emailed to you."
            />
            <Field
              label="Website URL"
              value={website}
              onChange={setWebsite}
              placeholder="https://www.acme.com/"
            />
          </div>
          <label className="block text-base font-medium text-zinc-700">
            Event
            <select
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value as BoothEventCode)}
            >
              {BOOTH_EVENTS.map((event) => (
                <option key={event.code} value={event.code}>
                  {event.label} — {event.name}
                </option>
              ))}
            </select>
          </label>
          <DataConsentCheckbox checked={consentAccepted} onChange={setConsentAccepted} />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            className="mt-2 w-full rounded-[0.625rem] bg-[#212121] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#3a3a3a] sm:w-auto"
          >
            {SITE.ctaLabel}
          </button>
        </form>
      </div>

      <HeroPreviewPanel />
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block text-base font-medium text-zinc-700">
      {label}
      <input
        type={type}
        required
        className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="mt-1.5 text-xs font-normal leading-5 text-zinc-500">{hint}</p> : null}
    </label>
  );
}

/** Decorative preview — mimics a results panel, not live data. Real results render on /audit. */
function HeroPreviewPanel() {
  return (
    <div className="relative flex flex-col justify-center bg-[#282828] p-8 text-white sm:p-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6e3fff]/20 via-transparent to-[#EB001A]/10" />
      <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
          Prompt
        </p>
        <p className="mt-2 text-sm font-semibold text-white">
          &ldquo;Who&apos;s the best AI-discoverable martech vendor for this?&rdquo;
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold text-white/80">Readiness signal</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-[#6e3fff] to-[#EB001A]" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-white/50">
            <span>At risk</span>
            <span>Developing</span>
            <span>Strong</span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-white/80">What we&apos;ll surface</p>
          <ul className="mt-2 space-y-1.5 text-xs text-white/60">
            <li className="border-l-2 border-[#6e3fff]/60 pl-2">Buyer personas asking about you</li>
            <li className="border-l-2 border-[#EB001A]/60 pl-2">Who AI names as your competitors</li>
            <li className="border-l-2 border-white/20 pl-2">Sample prompts people actually type</li>
          </ul>
        </div>
      </div>
      <p className="relative mt-5 text-xs text-white/40">
        Illustrative preview — your real audit runs live on the next screen.
      </p>
    </div>
  );
}
