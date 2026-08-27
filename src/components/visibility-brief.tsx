"use client";

import type { AeoAuditReport, AeoLead, VisibilityBrief, VisibilityBand } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { ReportShareActions } from "@/components/report-share-actions";

function bandClass(band: VisibilityBand) {
  if (band === "Healthy") return "text-emerald-700";
  if (band === "Average") return "text-amber-700";
  return "text-red-700";
}

function sentimentMark(value: VisibilityBrief["platforms"][number]["sentiment"]) {
  if (value === "Positive") return "Positive";
  if (value === "Mixed") return "Mixed";
  return "Negative";
}

export function VisibilityBriefView({
  brandName,
  website,
  visibility,
  lead,
  report,
}: {
  brandName: string;
  website: string;
  visibility: VisibilityBrief;
  lead?: AeoLead;
  report?: AeoAuditReport;
}) {
  const absent = Math.max(0, Math.round(100 - visibility.presencePct));

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_24px_60px_-36px_rgba(24,24,24,0.35)]">
      <div className="bg-[#17141f] px-6 py-7 text-white sm:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          AI visibility report · prepared by {SITE.productName}
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold">{brandName}</h2>
        <p className="mt-2 text-xs text-white/55">
          Research snapshot · {new Date().toLocaleDateString(undefined, { dateStyle: "medium" })} · not a live 30-day
          monitor
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="AI visibility score" value={`${visibility.score.toFixed(1)} / 100`} large />
          <Metric label="AI presence" value={`${visibility.presencePct.toFixed(1)}%`} hint="Unbranded queries" />
          <Metric label="Position" value={visibility.positionScore.toFixed(1)} hint="0–100 scale" />
          <Metric label="Citation share" value={`${visibility.citationSharePct.toFixed(1)}%`} hint="Brand-owned" />
          <Metric label="Sentiment" value={visibility.sentimentScore.toFixed(1)} hint="0–100 scale" />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-white/80">
          {visibility.headline ||
            `${brandName} is absent from ${absent}% of relevant AI conversations. That's the audience competitors are speaking to instead.`}
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold text-[#212121]">Executive overview</h3>
          <p className="mt-1 text-xs text-zinc-500">Unbranded queries only · estimated</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BandCard label="AI presence" band={visibility.presenceBand} value={`${visibility.presencePct.toFixed(1)}%`} />
            <BandCard label="Position score" band={visibility.positionBand} value={`${visibility.positionScore.toFixed(1)} / 100`} />
            <BandCard label="Citation share" band={visibility.citationBand} value={`${visibility.citationSharePct.toFixed(1)}%`} />
            <BandCard label="Sentiment score" band={visibility.sentimentBand} value={`${visibility.sentimentScore.toFixed(1)} / 100`} />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#212121]">Competitor AI presence</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Competitor</th>
                  <th className="py-2 pr-3">AI presence</th>
                  <th className="py-2 pr-3">Gap vs you</th>
                </tr>
              </thead>
              <tbody>
                {visibility.competitorPresence.map((row) => (
                  <tr key={row.name} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-[#212121]">
                      {row.name}
                      {row.isYou ? <span className="ml-2 text-xs font-semibold uppercase text-[#6e3fff]">You</span> : null}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.presencePct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-600">
                      {row.isYou ? "—" : `${row.gapPts.toFixed(1)} pts`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#212121]">Prompts you&apos;re losing to competitors</h3>
          <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200">
            {visibility.lostPrompts.map((item) => (
              <li key={item.prompt} className="px-4 py-3">
                <p className="text-sm text-[#212121]">&ldquo;{item.prompt}&rdquo;</p>
                <p className="mt-1 text-xs text-zinc-500">
                  ✕ {brandName}
                  {item.fillingBrand ? (
                    <span>
                      {" "}
                      · ✓ {item.fillingBrand}
                      {item.fillingPct ? ` ${item.fillingPct.toFixed(1)}%` : ""}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#212121]">Platform performance</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">AI platform</th>
                  <th className="py-2 pr-3">Presence</th>
                  <th className="py-2 pr-3">Position</th>
                  <th className="py-2 pr-3">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {visibility.platforms.map((row) => (
                  <tr key={row.name} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium">{row.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.presencePct.toFixed(1)}%</td>
                    <td className="py-2 pr-3">{row.position}</td>
                    <td className="py-2 pr-3">{sentimentMark(row.sentiment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#212121]">Who controls the narrative?</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Share label="Owned" value={visibility.narrative.ownedPct} />
            <Share label="Lost to competitors" value={visibility.narrative.lostToCompetitorsPct} />
            <Share label="Mention opportunities" value={visibility.narrative.mentionOpportunitiesPct} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <SourceList title="Brand URLs" rows={visibility.ownedUrls} />
            <SourceList title="Competitor domains" rows={visibility.competitorDomains} />
            <SourceList title="Mention opportunities" rows={visibility.mentionOpportunities} />
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Estimated from public research for {website}. Live {SITE.productName} reports track hundreds of prompts over
          time — talk to {SITE.presenterName} at the stand for the measured version.
        </p>

        <div className="flex flex-wrap gap-3">
          {lead && report ? (
            <ReportShareActions report={report} lead={lead} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  large,
}: {
  label: string;
  value: string;
  hint?: string;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className={`mt-1 font-semibold ${large ? "text-3xl" : "text-xl"}`}>{value}</p>
      {hint ? <p className="text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}

function BandCard({ label, band, value }: { label: string; band: VisibilityBand; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xs font-semibold ${bandClass(band)}`}>{band}</p>
      <p className="mt-1 text-lg font-semibold text-[#212121]">{value}</p>
    </div>
  );
}

function Share({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#212121]">{value.toFixed(1)}%</p>
    </div>
  );
}

function SourceList({ title, rows }: { title: string; rows: VisibilityBrief["ownedUrls"] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.source} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-zinc-700">{row.source}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">{row.estimatedCitations}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
