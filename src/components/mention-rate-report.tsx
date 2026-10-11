"use client";

import { useState } from "react";
import type { AeoAuditReport, AeoLead, CitationPrompt, MentionRateRow, MentionRateSnapshot } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { ReportShareActions } from "@/components/report-share-actions";
import { GenerationWaitPanel } from "@/components/generation-wait-panel";
import { GeminiUsageLine } from "@/components/gemini-usage-line";
import type { GeminiTokenUsage } from "@/lib/gemini-usage";

export function hostnameFromUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

function BrandMark({ name, website, size = 32 }: { name: string; website: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const host = hostnameFromUrl(website);
  const letter = (name.trim()[0] || "?").toUpperCase();

  if (!failed && host) {
    return (
      // Favicon lookup is display-only; letter avatar is the fallback.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`}
        alt=""
        width={size}
        height={size}
        className="rounded-full bg-white object-contain"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-[#212121]"
      style={{ width: size, height: size }}
    >
      {letter}
    </span>
  );
}

type MentionRateReportProps = {
  brandName: string;
  website: string;
  citationPrompts: CitationPrompt[];
  mentionRates: MentionRateRow[];
  rerunning?: boolean;
  onRerun?: () => void;
  lead?: AeoLead;
  report?: AeoAuditReport;
  usage?: GeminiTokenUsage | null;
};

export function MentionRateReport({
  brandName,
  website,
  citationPrompts,
  mentionRates,
  rerunning,
  onRerun,
  lead,
  report,
  usage,
}: MentionRateReportProps) {
  const host = hostnameFromUrl(website) || website;
  const ranked = [...mentionRates].sort((a, b) => b.estimatedPct - a.estimatedPct);
  const demoHref = SITE.presenterEmail
    ? `mailto:${SITE.presenterEmail}?subject=${encodeURIComponent(`${SITE.productName} demo — ${brandName}`)}`
    : SITE.siteUrl;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_24px_60px_-36px_rgba(24,24,24,0.35)]">
      <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="flex items-center gap-4">
            <BrandMark name={brandName} website={website} size={56} />
            <h2 className="font-sans text-3xl font-semibold tracking-tight text-[#212121] sm:text-4xl">
              {brandName}
            </h2>
          </div>
          <p className="mt-6 text-sm font-medium text-zinc-700">
            Here are a few prompts {host} may be cited in:
          </p>
          <ul className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            {citationPrompts.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500">No citation prompts yet — rerun the report.</li>
            ) : (
              citationPrompts.map((item, i) => (
                <li
                  key={`${item.prompt}-${i}`}
                  className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3.5 last:border-b-0"
                >
                  <p className="flex-1 text-sm leading-6 text-zinc-800">{item.prompt}</p>
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500"
                    title={item.note || "Why this prompt"}
                  >
                    i
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex flex-col">
          <h3 className="text-xl font-semibold text-[#212121]">Estimated Mention Rate</h3>
          <ol className="mt-4 space-y-1">
            {ranked.map((row, i) => {
              const rank = i + 1;
              const top = rank === 1;
              return (
                <li
                  key={`${row.name}-${row.website}`}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${
                    top ? "bg-[#f3eadc]" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold ${
                      top ? "bg-[#1a1a1a] text-white" : "text-zinc-500"
                    }`}
                  >
                    {rank}
                  </span>
                  <BrandMark name={row.name} website={row.website} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#212121]">
                    {row.name}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-[#212121]">
                    {Math.round(row.estimatedPct)}%
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Estimated from public research — not a live {SITE.productName} citation check. Talk to the
            stand for measured mention rate over time.
          </p>
          <GeminiUsageLine usage={usage ?? report?.usage} label="This run" />

          <div className="mt-6 flex flex-col gap-3">
            {rerunning ? <GenerationWaitPanel active compact /> : null}
            {onRerun ? (
              <button
                type="button"
                disabled={rerunning}
                onClick={onRerun}
                className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-[#212121] disabled:opacity-50"
              >
                {rerunning ? "Still researching…" : "Rerun report"}
              </button>
            ) : null}
            {lead && report ? <ReportShareActions report={report} lead={lead} layout="stack" /> : null}
            <a
              href={demoHref}
              {...(demoHref.startsWith("http")
                ? { target: "_blank" as const, rel: "noreferrer" }
                : {})}
              className="block w-full rounded-full bg-[#2563eb] px-5 py-3 text-center text-sm font-semibold text-white"
            >
              {SITE.demoCtaLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MentionRateReportFromSnapshot({
  snapshot,
  rerunning,
  onRerun,
  lead,
  report,
}: {
  snapshot: MentionRateSnapshot;
  rerunning?: boolean;
  onRerun?: () => void;
  lead?: AeoLead;
  report?: AeoAuditReport;
}) {
  return (
    <MentionRateReport
      brandName={snapshot.brandName}
      website={snapshot.website}
      citationPrompts={snapshot.citationPrompts}
      mentionRates={snapshot.mentionRates}
      rerunning={rerunning}
      onRerun={onRerun}
      lead={lead}
      report={report}
      usage={snapshot.usage}
    />
  );
}
