"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredBoothLead, StoredVisibilityReport } from "@/lib/audit-types";
import { emptyAuditReport } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { MentionRateReportFromSnapshot } from "@/components/mention-rate-report";
import { VisibilityBriefView } from "@/components/visibility-brief";

type VisitFilter = "all" | "today" | "repeat";

function isToday(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatWhen(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(leads: StoredBoothLead[]) {
  const header = [
    "Name",
    "Company",
    "Email",
    "Audited brand",
    "Website",
    "Created",
    "Updated",
    "Audit count",
  ];
  const rows = leads.map((l) =>
    [
      csvCell(l.name),
      csvCell(l.company),
      csvCell(l.email),
      csvCell(l.auditedBrand),
      csvCell(l.auditedWebsite),
      csvCell(l.createdAt),
      csvCell(l.updatedAt),
      csvCell(l.auditCount),
    ].join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tfm-scrunch-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20";

export function StandDeskView() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [leads, setLeads] = useState<StoredBoothLead[]>([]);
  const [query, setQuery] = useState("");
  const [visitFilter, setVisitFilter] = useState<VisitFilter>("all");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [visibilityReport, setVisibilityReport] = useState<StoredVisibilityReport | null>(null);

  const loadLeads = useCallback(async () => {
    const res = await fetch("/api/admin/leads");
    const data = (await res.json()) as { success?: boolean; leads?: StoredBoothLead[]; error?: string };
    if (res.status === 401) {
      setUnlocked(false);
      setLeads([]);
      return;
    }
    if (!res.ok || !data.success) throw new Error(data.error ?? "Could not load leads");
    setLeads(data.leads ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/leads/session");
        const data = (await res.json()) as { unlocked?: boolean };
        if (cancelled) return;
        if (!data.unlocked) {
          setUnlocked(false);
          return;
        }
        setUnlocked(true);
        await loadLeads();
      } catch {
        if (!cancelled) {
          setUnlocked(false);
          setError("Could not reach the stand desk.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLeads]);

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unlock failed");
      setSecret("");
      setUnlocked(true);
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLock() {
    await fetch("/api/admin/leads/session", { method: "DELETE" });
    setUnlocked(false);
    setLeads([]);
    setQuery("");
    setVisitFilter("all");
    setCompany("");
    setSelectedId(null);
    setVisibilityReport(null);
  }

  async function onRefresh() {
    setBusy(true);
    setError(null);
    try {
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRerun(lead: StoredBoothLead) {
    setRerunningId(lead.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        snapshot?: StoredBoothLead["lastReport"];
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Rerun failed");
      setSelectedId(lead.id);
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRerunningId(null);
    }
  }

  const companies = useMemo(() => {
    const names = [...new Set(leads.map((l) => l.company.trim()).filter(Boolean))];
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (visitFilter === "today" && !isToday(l.updatedAt || l.createdAt)) return false;
      if (visitFilter === "repeat" && l.auditCount < 2) return false;
      if (company && l.company.trim() !== company) return false;
      if (!q) return true;
      const hay = [l.name, l.company, l.email, l.auditedBrand, l.auditedWebsite].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [leads, query, visitFilter, company]);

  const selected = filtered.find((l) => l.id === selectedId) ?? leads.find((l) => l.id === selectedId) ?? null;
  const shareLead = selected
    ? { name: selected.name, company: selected.company, email: selected.email }
    : null;
  const shareReport = selected
    ? {
        ...emptyAuditReport(
          visibilityReport?.brandName || selected.lastReport?.brandName || selected.auditedBrand,
          visibilityReport?.website || selected.lastReport?.website || selected.auditedWebsite,
        ),
        citationPrompts:
          visibilityReport?.citationPrompts ?? selected.lastReport?.citationPrompts ?? [],
        mentionRates: visibilityReport?.mentionRates ?? selected.lastReport?.mentionRates ?? [],
        visibility: visibilityReport?.visibility ?? null,
      }
    : null;

  useEffect(() => {
    if (!selected?.email) {
      setVisibilityReport(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/reports?email=${encodeURIComponent(selected.email)}`);
        const data = (await res.json()) as { success?: boolean; report?: StoredVisibilityReport };
        if (cancelled) return;
        setVisibilityReport(res.ok && data.success && data.report ? data.report : null);
      } catch {
        if (!cancelled) setVisibilityReport(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.email, selected?.updatedAt, rerunningId]);

  if (unlocked === null) {
    return <p className="text-sm text-zinc-500">Checking stand desk…</p>;
  }

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#ece4ff] bg-white p-8 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">Stand desk</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[#212121]">Booth leads</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Staff only — enter the stand passcode to see today&apos;s visitors.
        </p>
        <form onSubmit={(e) => void onUnlock(e)} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">
            Passcode
            <input
              type="password"
              autoComplete="current-password"
              className={`${inputClass} mt-1`}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[0.625rem] bg-[#212121] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">Stand desk</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">Booth leads</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              {leads.length} {leads.length === 1 ? "visitor" : "visitors"} from {SITE.eventName}. Showing{" "}
              {filtered.length} after search and filters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={busy}
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              disabled={filtered.length === 0}
              className="rounded-[0.625rem] bg-[#212121] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => void onLock()}
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600"
            >
              Lock
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
            Search
            <input
              className={`${inputClass} mt-1`}
              placeholder="Name, email, company, website"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Visits
            <select
              className={`${inputClass} mt-1`}
              value={visitFilter}
              onChange={(e) => setVisitFilter(e.target.value as VisitFilter)}
            >
              <option value="all">All leads</option>
              <option value="today">Visited today</option>
              <option value="repeat">Repeat visitors</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Company
            <select
              className={`${inputClass} mt-1`}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#ece4ff] bg-white p-5">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {leads.length === 0
              ? "No leads yet — run an audit from the kiosk and refresh."
              : "No leads match this search or filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Company</th>
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Website</th>
                  <th className="py-2 pr-3 font-semibold">Created</th>
                  <th className="py-2 pr-3 font-semibold">Updated</th>
                  <th className="py-2 pr-3 font-semibold">Audits</th>
                  <th className="py-2 pr-3 font-semibold">Report</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-3 font-medium text-[#212121]">{lead.name || "—"}</td>
                    <td className="py-2 pr-3 text-zinc-700">{lead.company || "—"}</td>
                    <td className="py-2 pr-3">
                      <a className="text-[#6e3fff] underline" href={`mailto:${lead.email}`}>
                        {lead.email}
                      </a>
                    </td>
                    <td className="py-2 pr-3">
                      {lead.auditedWebsite ? (
                        <a
                          className="text-[#6e3fff] underline"
                          href={lead.auditedWebsite}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {lead.auditedWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">{formatWhen(lead.createdAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">{formatWhen(lead.updatedAt)}</td>
                    <td className="py-2 pr-3 text-zinc-700">{lead.auditCount || "—"}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(lead.id)}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          disabled={rerunningId === lead.id}
                          onClick={() => void onRerun(lead)}
                          className="rounded-lg bg-[#212121] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {rerunningId === lead.id ? "Rerunning…" : "Rerun"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">
              Mention-rate report for {selected.auditedBrand || selected.company}
            </p>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-sm font-semibold text-zinc-500"
            >
              Close
            </button>
          </div>
          {selected.lastReport ? (
            <MentionRateReportFromSnapshot
              snapshot={selected.lastReport}
              rerunning={rerunningId === selected.id}
              onRerun={() => void onRerun(selected)}
              lead={shareLead ?? undefined}
              report={shareReport ?? undefined}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              No saved mention-rate report for this lead yet.
              <button
                type="button"
                disabled={rerunningId === selected.id}
                onClick={() => void onRerun(selected)}
                className="ml-3 rounded-lg bg-[#212121] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {rerunningId === selected.id ? "Rerunning…" : "Rerun report"}
              </button>
            </div>
          )}
          {visibilityReport?.visibility ? (
            <VisibilityBriefView
              brandName={visibilityReport.brandName || selected.auditedBrand}
              website={visibilityReport.website || selected.auditedWebsite}
              visibility={visibilityReport.visibility}
              lead={{ name: selected.name, company: selected.company, email: selected.email }}
              report={shareReport ?? undefined}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
