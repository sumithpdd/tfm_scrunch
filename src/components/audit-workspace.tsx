"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AeoAuditReport, AeoLead } from "@/lib/audit-types";
import { AUDIT_STAGE_ORDER, parseExtraUrls, type AuditStageId } from "@/lib/audit-progress";
import { readAuditGenerateStream } from "@/lib/audit-stream";
import { emailLooksValid } from "@/lib/email";
import { SITE } from "@/lib/site-config";
import { MentionRateReport } from "@/components/mention-rate-report";
import { DataConsentCheckbox } from "@/components/data-consent-checkbox";
import { HoneypotField } from "@/components/honeypot-field";
import { ReportShareActions } from "@/components/report-share-actions";
import { GenerationWaitPanel, useGenerationWait } from "@/components/generation-wait-panel";
import { GeminiUsageLine } from "@/components/gemini-usage-line";
import { VisibilityBriefView } from "@/components/visibility-brief";

function readinessStyle(rating: AeoAuditReport["readiness"] | undefined) {
  switch (rating) {
    case "Strong":
      return { dot: "bg-emerald-500", text: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200" };
    case "At risk":
      return { dot: "bg-red-500", text: "text-red-800", bg: "bg-red-50 border-red-200" };
    default:
      return { dot: "bg-amber-500", text: "text-amber-900", bg: "bg-amber-50 border-amber-200" };
  }
}

function promptsToCsv(report: AeoAuditReport): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = "Prompt,Persona,Topic,Stage,Branded";
  const rows = report.prompts.map((p) =>
    [cell(p.prompt), cell(p.persona), cell(p.topic), cell(p.stage), cell(p.branded ? "yes" : "no")].join(","),
  );
  return [header, ...rows].join("\n");
}

function downloadCsv(report: AeoAuditReport) {
  const csv = promptsToCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-aeo-audit-prompts.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AuditWorkspace() {
  const params = useSearchParams();

  const [lead, setLead] = useState<AeoLead>({
    name: params.get("name") ?? "",
    company: params.get("company") ?? "",
    email: params.get("email")?.trim() ?? "",
  });
  const [brandName, setBrandName] = useState(params.get("company") ?? "");
  const [website, setWebsite] = useState(params.get("website") ?? "");
  const [extraUrls, setExtraUrls] = useState(params.get("extra") ?? "");
  const [honeypot, setHoneypot] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(params.get("consent") === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AeoAuditReport | null>(null);
  const [liveStage, setLiveStage] = useState("");
  const [liveDetail, setLiveDetail] = useState("");
  const [reachedStages, setReachedStages] = useState<AuditStageId[]>([]);
  const autoRan = useRef(false);
  const wait = useGenerationWait(busy);

  const runAudit = useCallback(async () => {
    if (!brandName.trim() || !website.trim() || !lead.name.trim() || !lead.email.trim()) {
      setError("Fill in your name, work email, company, and website first.");
      return;
    }
    if (!emailLooksValid(lead.email)) {
      setError("Enter a valid work email.");
      return;
    }
    if (!consentAccepted) {
      setError(SITE.consentLabel);
      return;
    }
    setBusy(true);
    setError(null);
    setLiveStage("Checking your details");
    setLiveDetail("");
    setReachedStages(["validate"]);
    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          brandName: brandName.trim(),
          website: website.trim(),
          extraUrls: parseExtraUrls(extraUrls),
          eventCode: SITE.eventCode,
          consentAccepted: true,
          websiteConfirm: honeypot,
        }),
      });
      const nextReport = await readAuditGenerateStream(res, (event) => {
        setLiveStage(event.label);
        setLiveDetail(event.detail ?? "");
        setReachedStages((current) =>
          current.includes(event.id) ? current : [...current, event.id],
        );
      });
      setReport(nextReport);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [brandName, website, extraUrls, lead, consentAccepted, honeypot]);

  useEffect(() => {
    if (autoRan.current) return;
    if (params.get("consent") !== "1") return;
    if (!brandName.trim() || !website.trim() || !lead.name.trim() || !lead.email.trim()) return;
    autoRan.current = true;
    queueMicrotask(() => void runAudit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">
          {SITE.productName} · {SITE.tagline}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">
          Your free AEO/GEO audit
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
          {SITE.companyName} {SITE.productName} researches your site the way an AI assistant would,
          then hypothesises how you show up: who asks about you, what they ask, who else gets named
          alongside you, and how discoverable you look today. This is a light-touch, research-based
          read — not a live {SITE.productName} monitor.
        </p>
      </section>

      <section className="relative rounded-2xl border border-[#ece4ff] bg-white p-5">
        <HoneypotField value={honeypot} onChange={setHoneypot} />
        <h2 className="font-serif text-xl font-semibold">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-base font-medium">
            Brand / company name
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal"
              placeholder="Brand name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </label>
          <label className="text-base font-medium">
            Primary website
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal"
              placeholder="https://www.example.com/"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
          <label className="text-base font-medium">
            Your name
            <input
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal"
              value={lead.name}
              onChange={(e) => setLead((l) => ({ ...l, name: e.target.value }))}
            />
          </label>
          <label className="text-base font-medium">
            Work email
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal"
              placeholder="you@company.com"
              value={lead.email}
              onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))}
            />
          </label>
        </div>
        <label className="mt-4 block text-base font-medium">
          Extra page URLs <span className="font-normal text-zinc-400">(optional, up to 3)</span>
          <textarea
            className="mt-1.5 min-h-[5rem] w-full rounded-xl border border-zinc-200 px-4 py-3 text-base font-normal"
            placeholder={"https://www.example.com/about\nhttps://www.example.com/pricing"}
            value={extraUrls}
            onChange={(e) => setExtraUrls(e.target.value)}
          />
        </label>
        <div className="mt-4">
          <DataConsentCheckbox
            id="audit-data-consent"
            checked={consentAccepted}
            onChange={setConsentAccepted}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || !consentAccepted}
            onClick={() => void runAudit()}
            className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.625rem] bg-[#212121] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {liveStage || wait.stage}
              </>
            ) : report ? (
              "Re-run audit"
            ) : (
              "Run my free audit"
            )}
          </button>
          {report ? (
            <>
              <button
                type="button"
                onClick={() => downloadCsv(report)}
                className="rounded-[0.625rem] border border-zinc-200 px-5 py-2.5 text-sm font-semibold"
              >
                Download sample prompts (CSV)
              </button>
              <ReportShareActions report={report} lead={lead} />
            </>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {report?.usage ? (
          <div className="mt-3">
            <GeminiUsageLine usage={report.usage} label="This run" />
          </div>
        ) : null}
        <div className="mt-4">
          <GenerationWaitPanel
            active={busy}
            wait={wait}
            liveStage={liveStage}
            liveDetail={liveDetail}
            steps={AUDIT_STAGE_ORDER.filter((step) => {
              if (step.id === "done") return false;
              if (step.id === "read_extra" && parseExtraUrls(extraUrls).length === 0) return false;
              return true;
            }).map((step) => ({
              label: step.label,
              done: reachedStages.includes(step.id) && liveStage !== step.label,
              active: liveStage === step.label,
            }))}
          />
        </div>
      </section>

      {report ? (
        <AuditReportView report={report} lead={lead} rerunning={busy} onRerun={() => void runAudit()} />
      ) : null}
    </div>
  );
}

function AuditReportView({
  report,
  lead,
  rerunning,
  onRerun,
}: {
  report: AeoAuditReport;
  lead: AeoLead;
  rerunning: boolean;
  onRerun: () => void;
}) {
  const style = readinessStyle(report.readiness);
  return (
    <div className="space-y-6">
      <MentionRateReport
        brandName={report.brandName}
        website={report.website}
        citationPrompts={report.citationPrompts}
        mentionRates={report.mentionRates}
        rerunning={rerunning}
        onRerun={onRerun}
        lead={lead}
        report={report}
      />

      {report.visibility ? (
        <VisibilityBriefView
          brandName={report.brandName}
          website={report.website}
          visibility={report.visibility}
          lead={lead}
          report={report}
        />
      ) : null}

      <section className={`rounded-2xl border p-5 ${style.bg}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          <p className={`text-sm font-semibold ${style.text}`}>
            AEO/GEO readiness: {report.readiness}
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{report.readinessSummary}</p>
      </section>

      <section className="rounded-2xl border border-[#ece4ff] bg-white p-5">
        <h2 className="font-serif text-xl font-semibold">
          {report.brandName}
          {report.primaryCountryLabel ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              · {report.primaryCountryLabel}
            </span>
          ) : null}
        </h2>
        <p className="mt-2 text-sm leading-7 text-zinc-600">{report.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Topics" value={report.counts.topics} />
          <Stat label="Personas" value={report.counts.personas} />
          <Stat label="Competitors" value={report.counts.competitors} />
          <Stat label="Sample prompts" value={report.counts.prompts} />
          <Stat label="Non-branded %" value={`${report.counts.nonBrandedPct}%`} />
          <Stat label="AI platforms" value={report.counts.platforms} />
        </dl>
      </section>

      <TableBlock
        title="Who's asking about you"
        subtitle="Personas an AI assistant would infer from your market"
        headers={["Persona", "Description"]}
        rows={report.personas.map((p) => [p.name, p.description])}
      />

      <TableBlock
        title="Topics you'd be asked about"
        headers={["Topic", "Description"]}
        rows={report.topics.map((t) => [t.name, t.description])}
      />

      <TableBlock
        title="Who AI names alongside you"
        headers={["Competitor", "Website", "Why they'd come up"]}
        rows={report.competitors.map((c) => [c.name, c.website, c.whyInScope])}
      />

      <TableBlock
        title="Sample prompts people actually type"
        headers={["Prompt", "Persona", "Topic", "Stage", "Branded"]}
        rows={report.prompts.map((p) => [
          p.prompt,
          p.persona,
          p.topic,
          p.stage,
          p.branded ? "yes" : "no",
        ])}
      />

      <TableBlock
        title="Hypotheses to test with a live Scrunch monitor"
        headers={["We'd expect", "Because", "Confirmed by", "Refuted by"]}
        rows={report.hypotheses.map((h) => [h.expect, h.because, h.confirmedBy, h.refutedBy])}
      />

      <section className="rounded-[1.75rem] border border-[#6e3fff]/20 bg-[#282828] p-6 text-white sm:p-8">
        <h2 className="font-serif text-xl font-semibold">Want the real, measured version?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-white/72">
          This audit is research-based, not a live citation check. {SITE.productName} monitors
          your actual mention rate across every major AI assistant, tracked over time
          {SITE.presenterEmail ? (
            <>
              . Email{" "}
              <a className="underline" href={`mailto:${SITE.presenterEmail}`}>
                {SITE.presenterEmail}
              </a>{" "}
              if you want the full picture
            </>
          ) : null}
          .
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-semibold text-[#212121]">{value}</dd>
    </div>
  );
}

function TableBlock({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#ece4ff] bg-white p-5">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
              {headers.map((h) => (
                <th key={h} className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 align-top">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 pr-3 text-zinc-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
