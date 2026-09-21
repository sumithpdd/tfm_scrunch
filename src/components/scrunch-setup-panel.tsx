"use client";

import type { StoredBoothLead } from "@/lib/audit-types";
import type { ScrunchConnectDiff, ScrunchSyncAction } from "@/lib/scrunch-diff-types";
import { ScrunchConnectPanel } from "@/components/scrunch-connect-panel";

export function ScrunchSetupPanel({
  lead,
  diff,
  busy,
  notice,
  onGenerate,
  onConnect,
  onSync,
}: {
  lead: StoredBoothLead;
  diff: ScrunchConnectDiff | null;
  busy: boolean;
  notice: string | null;
  onGenerate: () => void;
  onConnect: () => void;
  onSync: (action: ScrunchSyncAction) => void;
}) {
  const setup = lead.scrunchSetup;

  return (
    <div className="space-y-3 rounded-2xl border border-[#ece4ff] bg-[#faf8ff] p-4">
      <div>
        <p className="text-sm font-medium text-[#212121]">Scrunch brand setup</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Super admin only. Generate personas, topics, competitors, and prompt seeds, then compare
          and sync them into the live Scrunch brand.
        </p>
      </div>
      {setup ? (
        <p className="text-sm text-zinc-600">
          {setup.counts.personas} personas · {setup.counts.topics} topics · {setup.counts.competitors}{" "}
          competitors · {setup.counts.seeds} prompts
          {setup.primaryCountryLabel ? ` · ${setup.primaryCountryLabel}` : ""}
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
      </div>
      {setup?.description ? (
        <p className="text-sm leading-6 text-zinc-700">{setup.description}</p>
      ) : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {diff ? (
        <ScrunchConnectPanel diff={diff} busy={busy} onSync={onSync} onRefresh={onConnect} />
      ) : null}
    </div>
  );
}
