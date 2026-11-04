"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { StandDeskRole } from "@/lib/stand-desk";

type AuditEventOutcome =
  | "blocked_rate"
  | "blocked_captcha"
  | "blocked_bot"
  | "blocked_honeypot"
  | "blocked_validation"
  | "started"
  | "failed"
  | "completed";

type AuditEventRecord = {
  id: string;
  outcome: AuditEventOutcome;
  name: string;
  email: string;
  company: string;
  website: string;
  extraUrls: string[];
  error: string;
  durationMs: number | null;
  createdAt: string | null;
};

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20";

function outcomeStyle(outcome: AuditEventOutcome): { label: string; className: string } {
  switch (outcome) {
    case "completed":
      return { label: "Completed", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    case "started":
      return { label: "Started", className: "bg-zinc-50 text-zinc-600 border-zinc-200" };
    case "failed":
      return { label: "Failed", className: "bg-red-50 text-red-800 border-red-200" };
    default:
      return { label: outcome.replace(/^blocked_/, "Blocked — "), className: "bg-amber-50 text-amber-900 border-amber-200" };
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

export function AuditEventsView() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [role, setRole] = useState<StandDeskRole | null>(null);
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/admin/audit-events", { cache: "no-store" });
    const data = (await res.json()) as { success?: boolean; events?: AuditEventRecord[]; error?: string };
    if (res.status === 401) {
      setUnlocked(false);
      setEvents([]);
      return;
    }
    if (!res.ok || !data.success) throw new Error(data.error ?? "Could not load audit events");
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/leads/session");
        const data = (await res.json()) as { unlocked?: boolean; role?: StandDeskRole | null };
        if (cancelled) return;
        setUnlocked(Boolean(data.unlocked));
        setRole(data.role ?? null);
        if (data.unlocked) await loadEvents();
      } catch {
        if (!cancelled) setUnlocked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEvents]);

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
      const data = (await res.json()) as { success?: boolean; role?: StandDeskRole; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "That passcode doesn't match.");
      setUnlocked(true);
      setRole(data.role ?? null);
      setSecret("");
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    setError(null);
    try {
      await loadEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (unlocked === null) {
    return <p className="text-sm text-zinc-500">Checking stand desk…</p>;
  }

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#ece4ff] bg-white p-8 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">Stand desk</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[#212121]">Audit log</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Staff only. Same passcode as the leads desk. Shows every audit attempt — completed,
          failed, and blocked — so you can see why a visitor&apos;s audit didn&apos;t run.
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

  const filtered = onlyProblems
    ? events.filter((e) => e.outcome !== "completed" && e.outcome !== "started")
    : events;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">
              Stand desk · {role === "super" ? "Super admin" : "Booth AE"}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">Audit log</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Every audit attempt on the booth site — completed, failed, or blocked (rate limit,
              bot check, honeypot, missing fields) — newest first.
              {role !== "super" ? " Error detail is visible to the stand admin only." : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/stand-desk"
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Leads
            </Link>
            <button
              type="button"
              onClick={() => setOnlyProblems((v) => !v)}
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              {onlyProblems ? "Show all" : "Show problems only"}
            </button>
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={busy}
              className="rounded-[0.625rem] bg-[#212121] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="overflow-x-auto rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-2 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Website</th>
              <th className="px-3 py-2">Visitor</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {events.length === 0 ? "No audit events yet." : "No events match this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((event) => {
                const style = outcomeStyle(event.outcome);
                return (
                  <tr key={event.id} className="border-t border-zinc-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{formatWhen(event.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900">{event.company || "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-zinc-600">{event.website || "—"}</td>
                    <td className="px-3 py-2 text-zinc-600">
                      {event.name || "—"}
                      {event.email ? <div className="text-xs text-zinc-400">{event.email}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                      {event.durationMs != null ? `${(event.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="max-w-[320px] px-3 py-2 text-xs text-zinc-600">
                      {event.error ? <span className="break-words">{event.error}</span> : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
