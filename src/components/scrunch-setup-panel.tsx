"use client";

import type { StoredBoothLead } from "@/lib/audit-types";
import type { ScrunchConnectDiff, ScrunchSyncAction } from "@/lib/scrunch-diff-types";
import type { ScrunchBrandSetupDoc } from "@/lib/scrunch-setup-types";
import { ScrunchConnectPanel } from "@/components/scrunch-connect-panel";
import { downloadScrunchPromptCsv } from "@/lib/scrunch-csv";

export function ScrunchSetupPanel({
  lead,
  diff,
  busy,
  notice,
  error,
  onGenerate,
  onConnect,
  onSync,
}: {
  lead: StoredBoothLead;
  diff: ScrunchConnectDiff | null;
  busy: boolean;
  notice: string | null;
  error: string | null;
  onGenerate: () => void;
  onConnect: () => void;
  onSync: (action: ScrunchSyncAction) => void;
}) {
  const setup = lead.scrunchSetup;

  return (
    <div className="space-y-4 rounded-2xl border border-[#ece4ff] bg-[#faf8ff] p-4">
      <div>
        <p className="text-sm font-medium text-[#212121]">Scrunch brand setup</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Super admin only. Generate settings, compare them to the live Scrunch brand, then sync
          missing description, personas, competitors, and topics.
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Detail label="Brand" value={lead.auditedBrand || lead.company} />
        <Detail label="Website" value={lead.auditedWebsite || setup?.website || "—"} />
        <Detail label="Country" value={setup?.primaryCountryLabel || setup?.primaryCountry || "—"} />
        <Detail
          label="Created by"
          value={setup?.createdByEmail || setup?.createdByUid || lead.aeEmail || lead.email || "—"}
        />
        <Detail label="AE" value={lead.aeName ? `${lead.aeName} · ${lead.aeEmail}` : lead.aeEmail || "—"} />
        <Detail
          label="Scrunch ids"
          value={
            lead.scrunchBrandId
              ? `brand ${lead.scrunchBrandId}${lead.scrunchOrgId ? ` · org ${lead.scrunchOrgId}` : ""}`
              : "Not connected yet"
          }
        />
      </dl>

      {setup ? (
        <p className="text-sm text-zinc-600">
          {setup.counts.personas} personas · {setup.counts.topics} topics · {setup.counts.competitors}{" "}
          competitors · {setup.counts.seeds} prompts
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No Scrunch build sheet yet for this company.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="rounded-[0.625rem] bg-[#6e3fff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working…" : setup ? "Regenerate settings" : "Generate Scrunch settings"}
        </button>
        <button
          type="button"
          disabled={busy || !setup}
          onClick={onConnect}
          className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Compare to Scrunch
        </button>
        <button
          type="button"
          disabled={!setup || setup.prompts.length === 0}
          onClick={() => setup && downloadScrunchPromptCsv(setup)}
          className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Download prompt CSV
        </button>
      </div>

      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? (
        <p className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {diff ? (
        <ScrunchConnectPanel diff={diff} busy={busy} onSync={onSync} onRefresh={onConnect} />
      ) : null}

      {setup ? <ScrunchSetupDetails setup={setup} /> : null}
    </div>
  );
}

function ScrunchSetupDetails({ setup }: { setup: ScrunchBrandSetupDoc }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#ece8f8] bg-white p-4">
        <h3 className="font-serif text-lg font-semibold">Counts</h3>
        {setup.scopeDecision ? <p className="mt-2 text-sm text-zinc-600">{setup.scopeDecision}</p> : null}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Topics" value={setup.counts.topics} />
          <Stat label="Personas" value={setup.counts.personas} />
          <Stat label="Competitors" value={setup.counts.competitors} />
          <Stat label="Seeds" value={setup.counts.seeds} />
          <Stat label="Non-branded %" value={setup.counts.nonBrandedPct} />
          <Stat label="Variants est." value={setup.counts.variantsEstimate} />
          <Stat label="Country" value={setup.primaryCountry || "—"} />
          <Stat label="Language" value={setup.defaultLanguage || "—"} />
        </dl>
      </section>

      {setup.description ? (
        <section className="rounded-2xl border border-[#ece8f8] bg-white p-4">
          <h3 className="font-serif text-lg font-semibold">Brand description</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{setup.description}</p>
        </section>
      ) : null}

      <MarkdownBlock title="§0 Brief" body={setup.briefMarkdown} />
      <MarkdownBlock title="Bias check" body={setup.biasNotes} />

      <TableBlock
        title="Personas"
        headers={["Name", "Description"]}
        rows={setup.personas.map((p) => [p.name, p.description])}
      />
      <TableBlock
        title="Topics"
        headers={["Name", "Description"]}
        rows={setup.topics.map((t) => [t.name, t.description])}
      />
      <TableBlock
        title="Competitors"
        headers={["Name", "Alt names", "Website", "Why"]}
        rows={setup.competitors.map((c) => [c.name, c.altNames, c.website, c.whyInScope])}
      />
      <TableBlock
        title="Prompts"
        headers={["Prompt", "Topic", "Persona", "Stage", "Branded"]}
        rows={setup.prompts.map((p) => [
          p.prompt,
          p.topics,
          p.personas,
          p.stage,
          p.branded ? "yes" : "no",
        ])}
        action={
          setup.prompts.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadScrunchPromptCsv(setup)}
              className="rounded-[0.625rem] border border-zinc-200 px-3 py-1.5 text-xs font-semibold"
            >
              Download CSV
            </button>
          ) : null
        }
      />
      <TableBlock
        title="Hypotheses"
        headers={["Expect", "Because", "Confirmed by", "Refuted by"]}
        rows={setup.hypotheses.map((h) => [h.expect, h.because, h.confirmedBy, h.refutedBy])}
      />
      <TableBlock
        title="Open questions"
        headers={["Question", "Blocks", "How to settle"]}
        rows={setup.openQuestions.map((q) => [q.question, q.blocks, q.howToSettle])}
      />
      <TableBlock
        title="Alternative names"
        headers={["Name", "Why"]}
        rows={setup.alternativeNames.map((a) => [a.name, a.why])}
      />
      <TableBlock
        title="Alternative websites"
        headers={["URL", "Ownership"]}
        rows={setup.alternativeWebsites.map((a) => [a.url, a.ownership])}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-all text-sm text-[#212121]">{value}</dd>
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

function MarkdownBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <section className="rounded-2xl border border-[#ece8f8] bg-white p-4">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-700">
        {body}
      </pre>
    </section>
  );
}

function TableBlock({
  title,
  headers,
  rows,
  action,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  action?: React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#ece8f8] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-semibold">
          {title} <span className="text-sm font-normal text-zinc-400">({rows.length})</span>
        </h3>
        {action}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
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
