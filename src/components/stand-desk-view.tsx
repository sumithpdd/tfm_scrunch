"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AeoAuditReport, AeoLead, ScrunchBrandCheck, StoredBoothLead, StoredVisibilityReport } from "@/lib/audit-types";
import type { ScrunchConnectDiff, ScrunchSyncAction } from "@/lib/scrunch-diff-types";
import { emptyAuditReport } from "@/lib/audit-types";
import { BOOTH_EVENTS, DEFAULT_BOOTH_EVENT, type BoothEventCode } from "@/lib/booth-events";
import { SITE } from "@/lib/site-config";
import { parseScrunchDashboardUrl, scrunchDashboardUrl } from "@/lib/scrunch-app";
import type { StandDeskRole } from "@/lib/stand-desk";
import { GenerationWaitPanel } from "@/components/generation-wait-panel";
import { MentionRateReportFromSnapshot } from "@/components/mention-rate-report";
import { VisibilityBriefView } from "@/components/visibility-brief";
import { ScrunchSetupPanel } from "@/components/scrunch-setup-panel";

type VisitFilter = "all" | "today";
type ReportFilter = "all" | "scrunch" | "micro" | "none";
type SortKey = "recent" | "company";

const PAGE_SIZE = 40;

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

function hostLabel(website: string): string {
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "") || "—";
}

function csvCell(value: string | number | boolean): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(leads: StoredBoothLead[]) {
  const header = [
    "Name",
    "Company",
    "Email",
    "AE",
    "AE email",
    "Audited brand",
    "Website",
    "Event",
    "Scrunch PDF",
    "Scrunch brand",
    "Archived",
    "Hidden",
    "Micro-audit",
    "Created",
    "Updated",
    "Audit count",
  ];
  const rows = leads.map((l) =>
    [
      csvCell(l.name),
      csvCell(l.company),
      csvCell(l.email),
      csvCell(l.aeName),
      csvCell(l.aeEmail),
      csvCell(l.auditedBrand),
      csvCell(l.auditedWebsite),
      csvCell(l.eventCode || "TFM"),
      csvCell(l.hasScrunchPdf ? l.scrunchPdfFilename || "yes" : ""),
      csvCell(l.scrunchBrandId || ""),
      csvCell(l.archived ? "yes" : ""),
      csvCell(l.reportHidden ? "yes" : ""),
      csvCell(l.lastReport ? "yes" : ""),
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

type ArchiveFilter = "active" | "archived" | "all";

export function StandDeskView() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [role, setRole] = useState<StandDeskRole | null>(null);
  const [secret, setSecret] = useState("");
  const [leads, setLeads] = useState<StoredBoothLead[]>([]);
  const [query, setQuery] = useState("");
  const [visitFilter, setVisitFilter] = useState<VisitFilter>("all");
  const [eventFilter, setEventFilter] = useState<BoothEventCode>(DEFAULT_BOOTH_EVENT);
  const [reportFilter, setReportFilter] = useState<ReportFilter>("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [visibilityReport, setVisibilityReport] = useState<StoredVisibilityReport | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCompany, setAddCompany] = useState("");
  const [addWebsite, setAddWebsite] = useState("");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState<string>(SITE.defaultVisitorEmail);
  const [addAeName, setAddAeName] = useState("");
  const [addAeEmail, setAddAeEmail] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addEventCode, setAddEventCode] = useState<BoothEventCode>(DEFAULT_BOOTH_EVENT);
  const [addOrgId, setAddOrgId] = useState("");
  const [addBrandId, setAddBrandId] = useState("");
  const [detailTab, setDetailTab] = useState<"scrunch" | "pdf" | "micro">("scrunch");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [scrunchOrgId, setScrunchOrgId] = useState("");
  const [scrunchBrandId, setScrunchBrandId] = useState("");
  const [scrunchCheck, setScrunchCheck] = useState<ScrunchBrandCheck | null>(null);
  const [scrunchBusy, setScrunchBusy] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editAeName, setEditAeName] = useState("");
  const [editAeEmail, setEditAeEmail] = useState("");
  const [aeFilter, setAeFilter] = useState("all");
  const [reportFullscreen, setReportFullscreen] = useState(false);
  const [scrunchDiff, setScrunchDiff] = useState<ScrunchConnectDiff | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);

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
        const data = (await res.json()) as { unlocked?: boolean; role?: StandDeskRole | null };
        if (cancelled) return;
        if (!data.unlocked) {
          setUnlocked(false);
          setRole(null);
          return;
        }
        setUnlocked(true);
        setRole(data.role ?? "ae");
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
      const data = (await res.json()) as { success?: boolean; error?: string; role?: StandDeskRole };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Unlock failed");
      setSecret("");
      setUnlocked(true);
      setRole(data.role ?? "ae");
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
    setRole(null);
    setLeads([]);
    setQuery("");
    setVisitFilter("all");
    setEventFilter(DEFAULT_BOOTH_EVENT);
    setReportFilter("all");
    setArchiveFilter("active");
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
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Rerun failed");
      setSelectedId(lead.id);
      setDetailTab("micro");
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRerunningId(null);
    }
  }

  async function uploadPdf(fields: {
    company: string;
    website: string;
    name?: string;
    email?: string;
    eventCode?: string;
    scrunchOrgId?: string;
    scrunchBrandId?: string;
    file: File;
  }) {
    const form = new FormData();
    form.set("company", fields.company);
    form.set("website", fields.website);
    if (fields.name) form.set("name", fields.name);
    if (fields.email) form.set("email", fields.email);
    if (fields.eventCode) form.set("eventCode", fields.eventCode);
    if (fields.scrunchOrgId) form.set("scrunchOrgId", fields.scrunchOrgId);
    if (fields.scrunchBrandId) form.set("scrunchBrandId", fields.scrunchBrandId);
    form.set("file", fields.file);
    const res = await fetch("/api/admin/reports/pdf", { method: "POST", body: form });
    const data = (await res.json()) as { success?: boolean; error?: string; lead?: StoredBoothLead };
    if (!res.ok || !data.success || !data.lead) throw new Error(data.error ?? "Upload failed");
    return data.lead;
  }

  async function onAddCompany(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let lead: StoredBoothLead;
      if (addFile) {
        lead = await uploadPdf({
          company: addCompany,
          website: addWebsite,
          name: addName,
          email: addEmail,
          eventCode: addEventCode,
          scrunchOrgId: addOrgId,
          scrunchBrandId: addBrandId,
          file: addFile,
        });
      } else {
        const res = await fetch("/api/admin/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: addCompany,
            website: addWebsite,
            name: addName,
            email: addEmail,
            eventCode: addEventCode,
            aeName: addAeName,
            aeEmail: addAeEmail,
            scrunchOrgId: addOrgId,
            scrunchBrandId: addBrandId,
          }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string; lead?: StoredBoothLead };
        if (!res.ok || !data.success || !data.lead) throw new Error(data.error ?? "Could not add company");
        lead = data.lead;
      }
      setAddCompany("");
      setAddWebsite("");
      setAddName("");
      setAddEmail(SITE.defaultVisitorEmail);
      setAddAeName("");
      setAddAeEmail("");
      setAddFile(null);
      setAddOrgId("");
      setAddBrandId("");
      setEventFilter(addEventCode);
      setAddOpen(false);
      if (addAeName.trim() || addAeEmail.trim()) {
        await fetch("/api/admin/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lead.id, aeName: addAeName, aeEmail: addAeEmail }),
        });
      }
      await loadLeads();
      setSelectedId(lead.id);
      setDetailTab(lead.hasScrunchPdf ? "pdf" : "micro");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReplacePdf(lead: StoredBoothLead, file: File) {
    setBusy(true);
    setError(null);
    try {
      const saved = await uploadPdf({
        company: lead.company || lead.auditedBrand,
        website: lead.auditedWebsite,
        name: lead.name,
        email: lead.email,
        eventCode: lead.eventCode,
        file,
      });
      await loadLeads();
      setSelectedId(saved.id);
      setDetailTab("pdf");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckScrunch(lead: StoredBoothLead) {
    setScrunchBusy(true);
    setError(null);
    setSetupError(null);
    try {
      const res = await fetch("/api/admin/scrunch/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: lead.company || lead.auditedBrand,
          website: lead.auditedWebsite,
          orgId: scrunchOrgId,
          brandId: scrunchBrandId,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        check?: ScrunchBrandCheck;
      };
      if (!res.ok || !data.success || !data.check) {
        throw new Error(data.error ?? "Could not check Scrunch");
      }
      setScrunchCheck(data.check);
      if (data.check.brandId) setScrunchBrandId(data.check.brandId);
      if (data.check.orgId) setScrunchOrgId(data.check.orgId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setScrunchBusy(false);
    }
  }

  async function onSaveScrunch(lead: StoredBoothLead) {
    setScrunchBusy(true);
    setError(null);
    setSetupError(null);
    try {
      const res = await fetch("/api/admin/leads/scrunch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          orgId: scrunchOrgId,
          brandId: scrunchBrandId,
          brandName: scrunchCheck?.brandName,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not save Scrunch ids");
      await loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setScrunchBusy(false);
    }
  }

  async function onSyncScrunch(lead: StoredBoothLead) {
    setScrunchBusy(true);
    setError(null);
    setSetupError(null);
    try {
      const res = await fetch("/api/admin/scrunch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          orgId: scrunchOrgId,
          brandId: scrunchBrandId,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        check?: ScrunchBrandCheck;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not sync Scrunch");
      if (data.check) {
        setScrunchCheck(data.check);
        if (data.check.brandId) setScrunchBrandId(data.check.brandId);
        if (data.check.orgId) setScrunchOrgId(data.check.orgId);
      }
      await loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setScrunchBusy(false);
    }
  }

  async function onModerate(lead: StoredBoothLead, action: "archive" | "unarchive" | "hide" | "unhide" | "remove") {
    if (action === "remove") {
      const ok = window.confirm(`Remove ${lead.company || lead.auditedBrand} from the stand desk? This cannot be undone.`);
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, action }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not update company");
      if (action === "remove") {
        setSelectedId(null);
        setVisibilityReport(null);
      }
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAe(lead: StoredBoothLead) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, aeName: editAeName, aeEmail: editAeEmail }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not save AE");
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSeedAccounts() {
    setSeedBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; results?: { company: string; created: boolean; generated: boolean; error?: string }[] };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not import AE accounts");
      await loadLeads();
      const created = data.results?.filter((row) => row.created).length ?? 0;
      const generated = data.results?.filter((row) => row.generated).length ?? 0;
      const failed = data.results?.filter((row) => row.error).map((row) => row.company) ?? [];
      setSetupNotice(
        `AE accounts: ${created} new, ${generated} with reports.${failed.length ? ` Failed: ${failed.join(", ")}` : ""}`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSeedBusy(false);
    }
  }

  async function onGenerateSetup(lead: StoredBoothLead) {
    setSetupBusy(true);
    setError(null);
    setSetupError(null);
    setSetupNotice(null);
    try {
      const res = await fetch("/api/admin/scrunch/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; warning?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not generate Scrunch settings");
      await loadLeads();
      if (lead.scrunchBrandId || lead.scrunchSetup?.scrunchBrandId) {
        const compareRes = await fetch("/api/admin/scrunch/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lead.id }),
        });
        const compareData = (await compareRes.json()) as {
          success?: boolean;
          error?: string;
          diff?: ScrunchConnectDiff;
        };
        if (!compareRes.ok || !compareData.success || !compareData.diff) {
          throw new Error(compareData.error ?? "Settings generated, but compare to Scrunch failed.");
        }
        setScrunchDiff(compareData.diff);
        setSetupNotice(
          data.warning || "Settings generated and compared. Use Sync all missing to push into Scrunch.",
        );
      } else {
        setSetupNotice(
          data.warning ||
            "Settings generated. Save the Scrunch brand id, then Compare to Scrunch and sync.",
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setSetupBusy(false);
    }
  }

  async function onConnectSetup(lead: StoredBoothLead) {
    setSetupBusy(true);
    setError(null);
    setSetupError(null);
    try {
      const res = await fetch("/api/admin/scrunch/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; diff?: ScrunchConnectDiff };
      if (!res.ok || !data.success || !data.diff) throw new Error(data.error ?? "Could not compare Scrunch");
      setScrunchDiff(data.diff);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setSetupBusy(false);
    }
  }

  async function onEntitySync(lead: StoredBoothLead, action: ScrunchSyncAction) {
    setSetupBusy(true);
    setError(null);
    setSetupError(null);
    try {
      const res = await fetch("/api/admin/scrunch/entity-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, action }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        diff?: ScrunchConnectDiff;
        notice?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not sync Scrunch");
      if (data.diff) setScrunchDiff(data.diff);
      setSetupNotice(data.notice || "Synced.");
      if (data.error) setSetupError(data.error);
      await loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSetupError(msg);
      setError(msg);
    } finally {
      setSetupBusy(false);
    }
  }

  async function onSaveEmail(lead: StoredBoothLead) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, email: editEmail }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; lead?: StoredBoothLead };
      if (!res.ok || !data.success || !data.lead) throw new Error(data.error ?? "Could not save email");
      setEditEmail(data.lead.email);
      await loadLeads();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const isSuper = role === "super";

  const eventCounts = useMemo(() => {
    const counts = { TFM: 0, DMEXCO: 0, USERGROUP: 0 } as Record<BoothEventCode, number>;
    for (const lead of leads) {
      const code = (lead.eventCode || DEFAULT_BOOTH_EVENT) as BoothEventCode;
      if (code in counts) counts[code] += 1;
    }
    return counts;
  }, [leads]);

  const aeExecs = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      if (lead.aeEmail) map.set(lead.aeEmail, lead.aeName || lead.aeEmail);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const eventLeads = useMemo(
    () => leads.filter((lead) => (lead.eventCode || DEFAULT_BOOTH_EVENT) === eventFilter),
    [leads, eventFilter],
  );

  const stats = useMemo(
    () => ({
      total: eventLeads.length,
      scrunch: eventLeads.filter((l) => l.hasScrunchPdf).length,
      micro: eventLeads.filter((l) => Boolean(l.lastReport) && !l.hasScrunchPdf).length,
      none: eventLeads.filter((l) => !l.hasScrunchPdf && !l.lastReport).length,
    }),
    [eventLeads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = leads.filter((l) => {
      if ((l.eventCode || DEFAULT_BOOTH_EVENT) !== eventFilter) return false;
      if (visitFilter === "today" && !isToday(l.updatedAt || l.createdAt)) return false;
      if (reportFilter === "scrunch" && !l.hasScrunchPdf) return false;
      if (reportFilter === "micro" && (!l.lastReport || l.hasScrunchPdf)) return false;
      if (reportFilter === "none" && (l.hasScrunchPdf || l.lastReport)) return false;
      if (isSuper && archiveFilter === "active" && l.archived) return false;
      if (isSuper && archiveFilter === "archived" && !l.archived) return false;
      if (aeFilter !== "all" && l.aeEmail !== aeFilter) return false;
      if (!q) return true;
      const hay = [l.name, l.company, l.email, l.aeName, l.aeEmail, l.auditedBrand, l.auditedWebsite, l.scrunchPdfFilename]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    rows.sort((a, b) => {
      if (sortKey === "company") {
        return (a.company || a.auditedBrand).localeCompare(b.company || b.auditedBrand);
      }
      return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
    });
    return rows;
  }, [leads, query, visitFilter, reportFilter, sortKey, eventFilter, archiveFilter, aeFilter, isSuper]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, visitFilter, reportFilter, sortKey, eventFilter, archiveFilter, aeFilter]);

  const selected = filtered.find((l) => l.id === selectedId) ?? leads.find((l) => l.id === selectedId) ?? null;
  const selectedScrunchHref = scrunchDashboardUrl(scrunchOrgId, scrunchBrandId);
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
    if (!selected?.auditedWebsite && !selected?.email) {
      setVisibilityReport(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (selected.auditedWebsite) params.set("website", selected.auditedWebsite);
        if (selected.email) params.set("email", selected.email);
        const res = await fetch(`/api/admin/reports?${params.toString()}`);
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
  }, [selected?.auditedWebsite, selected?.email, selected?.updatedAt, rerunningId]);

  useEffect(() => {
    if (!selected) return;
    if (role === "super") setDetailTab("scrunch");
    else if (selected.hasScrunchPdf) setDetailTab("pdf");
    else if (selected.lastReport) setDetailTab("micro");
    else setDetailTab("scrunch");
  }, [selected?.id, role]);

  useEffect(() => {
    setScrunchOrgId(selected?.scrunchOrgId || "");
    setScrunchBrandId(selected?.scrunchBrandId || "");
    setScrunchCheck(null);
  }, [selected?.id, selected?.scrunchOrgId, selected?.scrunchBrandId]);

  useEffect(() => {
    setEditEmail(selected?.email ?? "");
    setEditAeName(selected?.aeName ?? "");
    setEditAeEmail(selected?.aeEmail ?? "");
    setScrunchDiff(null);
    setSetupNotice(null);
    setSetupError(null);
    if (!selected) setReportFullscreen(false);
  }, [selected?.id, selected?.email, selected?.aeName, selected?.aeEmail]);

  useEffect(() => {
    if (!reportFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReportFullscreen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [reportFullscreen]);

  if (unlocked === null) {
    return <p className="text-sm text-zinc-500">Checking stand desk…</p>;
  }

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#ece4ff] bg-white p-8 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">Stand desk</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[#212121]">Booth leads</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Staff only. Booth AEs can search companies and run audits. The stand admin passcode
          unlocks archive, hide, remove, and Scrunch connect/sync.
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
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">
              Stand desk · {isSuper ? "Super admin" : "Booth AE"}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">Booth companies</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Filter by event — TFM, DMEXCO, and Usergroup can run the same day. Existing
              records without an event stay on TFM. Search a company, open its Scrunch PDF, or
              run a live micro-audit. {stats.total} companies on this event.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAddEventCode(eventFilter);
                setAddOpen((v) => !v);
              }}
              className="rounded-[0.625rem] bg-[#6e3fff] px-4 py-2 text-sm font-semibold text-white"
            >
              {addOpen ? "Close add" : "Add company / PDF"}
            </button>
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={busy}
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Refresh
            </button>
            {isSuper ? (
              <button
                type="button"
                disabled={seedBusy}
                onClick={() => void onSeedAccounts()}
                className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {seedBusy ? "Importing AE accounts…" : "Import AE accounts"}
              </button>
            ) : null}
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

        <div className="mt-5 flex flex-wrap gap-2">
          {BOOTH_EVENTS.map((event) => {
            const active = eventFilter === event.code;
            return (
              <button
                key={event.code}
                type="button"
                onClick={() => setEventFilter(event.code)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  active ? "bg-[#212121] text-white" : "border border-zinc-200 text-zinc-700"
                }`}
              >
                {event.label}
                <span className={`ml-2 text-xs ${active ? "text-white/70" : "text-zinc-500"}`}>
                  {eventCounts[event.code]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <StatChip label="Companies" value={stats.total} />
          <StatChip label="Scrunch PDFs" value={stats.scrunch} />
          <StatChip label="Micro-audits only" value={stats.micro} />
          <StatChip label="No report yet" value={stats.none} />
        </div>

        {addOpen ? (
          <form
            onSubmit={(e) => void onAddCompany(e)}
            className="mt-5 grid gap-3 rounded-2xl border border-[#ece4ff] bg-[#faf8ff] p-4 sm:grid-cols-2"
          >
            <p className="sm:col-span-2 text-sm font-medium text-[#212121]">
              Sync a company you already ran in Scrunch. Website is the key — attach the official PDF
              if you have it.
            </p>
            <label className="text-sm font-medium text-zinc-700">
              Company
              <input
                className={`${inputClass} mt-1`}
                value={addCompany}
                onChange={(e) => setAddCompany(e.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Website
              <input
                className={`${inputClass} mt-1`}
                placeholder="https://www.acme.com"
                value={addWebsite}
                onChange={(e) => setAddWebsite(e.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Contact name (optional)
              <input className={`${inputClass} mt-1`} value={addName} onChange={(e) => setAddName(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Contact email (optional)
              <input
                type="email"
                className={`${inputClass} mt-1`}
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Account exec
              <input
                className={`${inputClass} mt-1`}
                placeholder="Rajeevan Rai"
                value={addAeName}
                onChange={(e) => setAddAeName(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              AE email
              <input
                type="email"
                className={`${inputClass} mt-1`}
                placeholder="rai@sitecore.net"
                value={addAeEmail}
                onChange={(e) => setAddAeEmail(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Event
              <select
                className={`${inputClass} mt-1`}
                value={addEventCode}
                onChange={(e) => setAddEventCode(e.target.value as BoothEventCode)}
              >
                {BOOTH_EVENTS.map((event) => (
                  <option key={event.code} value={event.code}>
                    {event.label} — {event.name}
                  </option>
                ))}
              </select>
            </label>
            {isSuper ? (
            <>
            <label className="text-sm font-medium text-zinc-700">
              Scrunch org id (optional)
              <input
                className={`${inputClass} mt-1`}
                placeholder="org id or dashboard URL"
                value={addOrgId}
                onChange={(e) => {
                  const parsed = parseScrunchDashboardUrl(e.target.value);
                  if (parsed) {
                    setAddOrgId(parsed.orgId);
                    setAddBrandId(parsed.brandId);
                    return;
                  }
                  setAddOrgId(e.target.value);
                }}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Scrunch brand id (optional)
              <input
                className={`${inputClass} mt-1`}
                placeholder="brand id from /b/…"
                value={addBrandId}
                onChange={(e) => {
                  const parsed = parseScrunchDashboardUrl(e.target.value);
                  if (parsed) {
                    setAddOrgId(parsed.orgId);
                    setAddBrandId(parsed.brandId);
                    return;
                  }
                  setAddBrandId(e.target.value);
                }}
              />
            </label>
            </>
            ) : null}
            <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
              Scrunch report PDF (optional, max 8 MB)
              <input
                type="file"
                accept="application/pdf"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setAddFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-[0.625rem] bg-[#212121] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : addFile ? "Save company + PDF" : "Save company"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 lg:col-span-2">
            Search companies
            <input
              className={`${inputClass} mt-1 text-base`}
              placeholder="Company, website, name, email, AE…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Report
            <select
              className={`${inputClass} mt-1`}
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value as ReportFilter)}
            >
              <option value="all">All reports</option>
              <option value="scrunch">Has Scrunch PDF</option>
              <option value="micro">Micro-audit only</option>
              <option value="none">No report yet</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Account exec
            <select
              className={`${inputClass} mt-1`}
              value={aeFilter}
              onChange={(e) => setAeFilter(e.target.value)}
            >
              <option value="all">All AEs</option>
              {aeExecs.map(([email, name]) => (
                <option key={email} value={email}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {isSuper ? (
            <label className="text-sm font-medium text-zinc-700">
              Visibility
              <select
                className={`${inputClass} mt-1`}
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-zinc-700">
              When
              <select
                className={`${inputClass} mt-1`}
                value={visitFilter}
                onChange={(e) => setVisitFilter(e.target.value as VisitFilter)}
              >
                <option value="all">All time</option>
                <option value="today">Updated today</option>
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Sort
              <select
                className={`${inputClass} mt-1`}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="company">A–Z</option>
                <option value="recent">Recent</option>
              </select>
            </label>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,40rem)]">
        <section className="rounded-2xl border border-[#ece4ff] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
            <p>
              Showing {pageRows.length} of {filtered.length}
              {filtered.length !== leads.length ? ` (filtered from ${leads.length})` : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          {pageRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {leads.length === 0
                ? "No companies yet — add a Scrunch PDF or run a kiosk audit."
                : "No companies match this search or filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-3 font-semibold">Company</th>
                    <th className="py-2 pr-3 font-semibold">AE</th>
                    <th className="py-2 pr-3 font-semibold">Website</th>
                    <th className="py-2 pr-3 font-semibold">Event</th>
                    <th className="py-2 pr-3 font-semibold">Reports</th>
                    <th className="py-2 pr-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((lead) => {
                    const active = lead.id === selected?.id;
                    const scrunchHref = scrunchDashboardUrl(lead.scrunchOrgId, lead.scrunchBrandId);
                    return (
                      <tr
                        key={lead.id}
                        className={`cursor-pointer border-b border-zinc-100 align-top ${
                          active ? "bg-[#f4efff]" : "hover:bg-zinc-50"
                        }`}
                        onClick={() => {
                          setSelectedId(lead.id);
                          setDetailTab(lead.hasScrunchPdf ? "pdf" : "micro");
                        }}
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-[#212121]">{lead.company || lead.auditedBrand || "—"}</p>
                          <p className="text-xs text-zinc-500">{lead.name || "No visitor name yet"}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-700">
                          <p>{lead.aeName || "—"}</p>
                          {lead.aeEmail ? <p className="text-xs text-zinc-500">{lead.aeEmail}</p> : null}
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-700">{hostLabel(lead.auditedWebsite)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                            {lead.eventCode || "TFM"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {lead.hasScrunchPdf ? (
                              <span className="rounded-full bg-[#ece4ff] px-2 py-0.5 text-[11px] font-semibold text-[#4715af]">
                                Scrunch PDF
                              </span>
                            ) : null}
                            {lead.lastReport ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                                Micro-audit
                              </span>
                            ) : null}
                            {lead.archived ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Archived
                              </span>
                            ) : null}
                            {lead.reportHidden ? (
                              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-white">
                                Hidden
                              </span>
                            ) : null}
                            {scrunchHref ? (
                              <a
                                href={scrunchHref}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full bg-[#212121] px-2 py-0.5 text-[11px] font-semibold text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Scrunch
                              </a>
                            ) : null}
                            {!lead.hasScrunchPdf && !lead.lastReport ? (
                              <span className="text-xs text-zinc-400">None</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-zinc-600">
                          {formatWhen(lead.updatedAt || lead.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={reportFullscreen ? undefined : "xl:sticky xl:top-24 xl:self-start"}>
          {selected ? (
            <div
              className={
                reportFullscreen
                  ? "fixed inset-0 z-[80] space-y-4 overflow-y-auto bg-white p-5 sm:p-8"
                  : "space-y-4 rounded-2xl border border-[#ece4ff] bg-white p-5"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e3fff]">Selected</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-[#212121]">
                    {selected.company || selected.auditedBrand}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {hostLabel(selected.auditedWebsite)} · {selected.eventName || selected.eventCode || "TFM"}
                  </p>
                  <div className="mt-3 max-w-md">
                    <label className="text-sm font-medium text-zinc-700">
                      Visitor email
                      <span className="ml-1 font-normal text-zinc-400">
                        {isSuper ? "— used when sending the report" : "— booth AEs can correct this"}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          type="email"
                          className={`${inputClass} min-w-[14rem] flex-1`}
                          placeholder="visitor@company.com"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy || editEmail.trim().toLowerCase() === selected.email}
                          onClick={() => void onSaveEmail(selected)}
                          className="rounded-[0.625rem] bg-[#6e3fff] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Save email
                        </button>
                      </div>
                    </label>
                    <label className="mt-3 block text-sm font-medium text-zinc-700">
                      Account exec
                      <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input
                          className={inputClass}
                          placeholder="AE name"
                          value={editAeName}
                          onChange={(e) => setEditAeName(e.target.value)}
                        />
                        <input
                          type="email"
                          className={inputClass}
                          placeholder="ae@sitecore.net"
                          value={editAeEmail}
                          onChange={(e) => setEditAeEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={
                            busy ||
                            (editAeName.trim() === selected.aeName &&
                              editAeEmail.trim().toLowerCase() === selected.aeEmail)
                          }
                          onClick={() => void onSaveAe(selected)}
                          className="rounded-[0.625rem] border border-zinc-200 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                        >
                          Save AE
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReportFullscreen((open) => !open)}
                    className="rounded-[0.625rem] border border-zinc-200 px-3 py-1.5 text-sm font-semibold"
                  >
                    {reportFullscreen ? "Exit full screen" : "Full screen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportFullscreen(false);
                      setSelectedId(null);
                    }}
                    className="text-sm font-semibold text-zinc-500"
                  >
                    Close
                  </button>
                </div>
              </div>

              {isSuper ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onModerate(selected, selected.archived ? "unarchive" : "archive")}
                    className="rounded-[0.625rem] border border-zinc-200 px-3 py-1.5 text-xs font-semibold"
                  >
                    {selected.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onModerate(selected, selected.reportHidden ? "unhide" : "hide")}
                    className="rounded-[0.625rem] border border-zinc-200 px-3 py-1.5 text-xs font-semibold"
                  >
                    {selected.reportHidden ? "Unhide report" : "Hide report"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onModerate(selected, "remove")}
                    className="rounded-[0.625rem] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["scrunch", "Scrunch"],
                    ["pdf", "Scrunch PDF"],
                    ["micro", "Micro-audit"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailTab(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      detailTab === id ? "bg-[#212121] text-white" : "border border-zinc-200 text-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {detailTab === "scrunch" ? (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-2xl border border-[#ece4ff] bg-[#faf8ff] p-4">
                    <div>
                      <p className="text-sm font-medium text-[#212121]">Scrunch brand</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {isSuper
                          ? "Save the org id and brand id, generate settings, compare to the live brand, then sync missing entities. Only the stand admin can do this."
                          : selectedScrunchHref
                            ? "This brand is already in Scrunch. Open the dashboard to review it."
                            : "Ask the stand admin to connect and validate this brand in Scrunch."}
                      </p>
                    </div>
                    {isSuper ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium text-zinc-700">
                          Org id
                          <input
                            className={`${inputClass} mt-1`}
                            placeholder="org id or dashboard URL"
                            value={scrunchOrgId}
                            onChange={(e) => {
                              const parsed = parseScrunchDashboardUrl(e.target.value);
                              if (parsed) {
                                setScrunchOrgId(parsed.orgId);
                                setScrunchBrandId(parsed.brandId);
                                return;
                              }
                              setScrunchOrgId(e.target.value);
                            }}
                          />
                        </label>
                        <label className="text-sm font-medium text-zinc-700">
                          Brand id
                          <input
                            className={`${inputClass} mt-1`}
                            placeholder="brand id from /b/…"
                            value={scrunchBrandId}
                            onChange={(e) => {
                              const parsed = parseScrunchDashboardUrl(e.target.value);
                              if (parsed) {
                                setScrunchOrgId(parsed.orgId);
                                setScrunchBrandId(parsed.brandId);
                                return;
                              }
                              setScrunchBrandId(e.target.value);
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {isSuper ? (
                        <>
                          <button
                            type="button"
                            disabled={scrunchBusy}
                            onClick={() => void onCheckScrunch(selected)}
                            className="rounded-[0.625rem] bg-[#6e3fff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {scrunchBusy ? "Checking…" : "Check in Scrunch"}
                          </button>
                          <button
                            type="button"
                            disabled={scrunchBusy || (!scrunchOrgId.trim() && !scrunchBrandId.trim())}
                            onClick={() => void onSaveScrunch(selected)}
                            className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            Save ids
                          </button>
                          <button
                            type="button"
                            disabled={scrunchBusy}
                            onClick={() => void onSyncScrunch(selected)}
                            className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            Sync from Scrunch
                          </button>
                        </>
                      ) : null}
                      {selectedScrunchHref ? (
                        <a
                          href={selectedScrunchHref}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[0.625rem] bg-[#212121] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Open dashboard
                        </a>
                      ) : null}
                    </div>
                    {scrunchCheck ? (
                      <p className={`text-sm ${scrunchCheck.found ? "text-emerald-700" : "text-zinc-600"}`}>
                        {scrunchCheck.message}
                        {scrunchCheck.brandName ? ` · ${scrunchCheck.brandName}` : ""}
                      </p>
                    ) : selected.scrunchBrandId ? (
                      <p className="text-sm text-zinc-600">
                        Saved{selected.scrunchBrandName ? `: ${selected.scrunchBrandName}` : ""} (#
                        {selected.scrunchBrandId})
                      </p>
                    ) : null}
                    {setupError && !isSuper ? (
                      <p className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {setupError}
                      </p>
                    ) : null}
                  </div>

                  {isSuper ? (
                    <ScrunchSetupPanel
                      lead={selected}
                      diff={scrunchDiff}
                      busy={setupBusy}
                      notice={setupNotice}
                      error={setupError}
                      onGenerate={() => void onGenerateSetup(selected)}
                      onConnect={() => void onConnectSetup(selected)}
                      onSync={(action) => void onEntitySync(selected, action)}
                    />
                  ) : null}
                </div>
              ) : (
                <SelectedReportPanels
                  selected={selected}
                  isSuper={isSuper}
                  detailTab={detailTab}
                  visibilityReport={visibilityReport}
                  shareLead={shareLead}
                  shareReport={shareReport}
                  rerunningId={rerunningId}
                  onRerun={onRerun}
                  onReplacePdf={onReplacePdf}
                  busy={busy}
                  fullscreen={reportFullscreen}
                />
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#ece4ff] bg-white p-6 text-sm text-zinc-500">
              Select a company from the list to open its Scrunch PDF or micro-audit. Search first if
              you are looking through hundreds of records.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SelectedReportPanels({
  selected,
  isSuper,
  detailTab,
  visibilityReport,
  shareLead,
  shareReport,
  rerunningId,
  onRerun,
  onReplacePdf,
  busy,
  fullscreen,
}: {
  selected: StoredBoothLead;
  isSuper: boolean;
  detailTab: "pdf" | "micro";
  visibilityReport: StoredVisibilityReport | null;
  shareLead: AeoLead | null;
  shareReport: AeoAuditReport | null;
  rerunningId: string | null;
  onRerun: (lead: StoredBoothLead) => void;
  onReplacePdf: (lead: StoredBoothLead, file: File) => void;
  busy: boolean;
  fullscreen: boolean;
}) {
  return (
    <div className="space-y-4">
      {selected.reportHidden && !isSuper ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          This report is hidden by the stand admin.
        </p>
      ) : null}

      {detailTab === "pdf" ? (
        <div className="space-y-3">
          {selected.hasScrunchPdf ? (
            <>
              <p className="text-sm text-zinc-600">
                {selected.scrunchPdfFilename || "Scrunch report.pdf"}
                {selected.scrunchPdfUploadedAt
                  ? ` · uploaded ${formatWhen(selected.scrunchPdfUploadedAt)}`
                  : ""}
              </p>
              {!fullscreen ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/reports/pdf?website=${encodeURIComponent(selected.auditedWebsite)}&inline=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[0.625rem] bg-[#6e3fff] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open PDF
                  </a>
                  <a
                    href={`/api/admin/reports/pdf?website=${encodeURIComponent(selected.auditedWebsite)}`}
                    className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold"
                  >
                    Download
                  </a>
                </div>
              ) : null}
              <iframe
                title={`Scrunch PDF for ${selected.company}`}
                src={`/api/admin/reports/pdf?website=${encodeURIComponent(selected.auditedWebsite)}&inline=1`}
                className={`w-full rounded-xl border border-zinc-200 bg-zinc-50 ${
                  fullscreen ? "h-[calc(100vh-10rem)]" : "h-[32rem]"
                }`}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-500">No official Scrunch PDF on file for this website yet.</p>
          )}
          {!fullscreen ? (
            <label className="block text-sm font-medium text-zinc-700">
              {selected.hasScrunchPdf ? "Replace Scrunch PDF" : "Upload Scrunch PDF"}
              <input
                type="file"
                accept="application/pdf"
                className="mt-1 block w-full text-sm"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onReplacePdf(selected, file);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {selected.lastReport ? (
            <MentionRateReportFromSnapshot
              snapshot={selected.lastReport}
              rerunning={rerunningId === selected.id}
              onRerun={() => void onRerun(selected)}
              lead={shareLead ?? undefined}
              report={shareReport ?? undefined}
            />
          ) : (
            <div className="space-y-3">
              {rerunningId === selected.id ? (
                <GenerationWaitPanel active compact />
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No live micro-audit yet for this website.
                  <button
                    type="button"
                    disabled={!selected.auditedWebsite}
                    onClick={() => void onRerun(selected)}
                    className="ml-3 rounded-lg bg-[#212121] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Run micro-audit
                  </button>
                </div>
              )}
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
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#ece4ff] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#212121]">{value}</p>
    </div>
  );
}
