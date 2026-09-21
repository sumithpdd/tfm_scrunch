"use client";

import type { ReactNode } from "react";
import type {
  ScrunchCompetitorDiffItem,
  ScrunchConnectDiff,
  ScrunchDiffStatus,
  ScrunchPersonaDiffItem,
  ScrunchSyncAction,
  ScrunchTopicDiffItem,
} from "@/lib/scrunch-diff-types";

function statusLabel(status: ScrunchDiffStatus | "empty"): string {
  switch (status) {
    case "matched":
      return "In sync";
    case "missing_in_scrunch":
      return "Missing in Scrunch";
    case "only_in_scrunch":
      return "Only in Scrunch";
    case "changed":
      return "Different";
    case "empty":
      return "Empty";
    default:
      return status;
  }
}

function statusClass(status: ScrunchDiffStatus | "empty"): string {
  switch (status) {
    case "matched":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "missing_in_scrunch":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "only_in_scrunch":
      return "bg-sky-50 text-sky-900 border-sky-200";
    case "changed":
      return "bg-orange-50 text-orange-900 border-orange-200";
    default:
      return "bg-zinc-50 text-zinc-600 border-zinc-200";
  }
}

function Badge({ status }: { status: ScrunchDiffStatus | "empty" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  busy,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  tone?: "default" | "danger" | "accent";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 text-red-800"
      : tone === "accent"
        ? "border-[#d9cff8] text-[#8629ff]"
        : "border-zinc-200 text-zinc-800";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50 ${toneClass}`}
    >
      {label}
    </button>
  );
}

export function ScrunchConnectPanel({
  diff,
  busy,
  onSync,
  onRefresh,
}: {
  diff: ScrunchConnectDiff;
  busy: boolean;
  onSync: (action: ScrunchSyncAction) => void;
  onRefresh: () => void;
}) {
  const desc = diff.description;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#1e1c22]">{diff.message}</p>
          {busy ? <p className="mt-1 text-xs text-zinc-500">Syncing with Scrunch…</p> : null}
          {diff.brandId ? (
            <p className="mt-1 text-xs text-zinc-500">
              Comparing sheet ↔ Scrunch brand #{diff.brandId}
              {diff.brandName ? ` · ${diff.brandName}` : ""}
            </p>
          ) : null}
        </div>
        <ActionBtn label="Refresh compare" onClick={onRefresh} busy={busy} tone="accent" />
      </div>

      {!diff.configured || !diff.brandId ? null : (
        <>
          <section className="rounded-xl border border-white bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">Brand description</h4>
              <Badge status={desc.status} />
            </div>
            {desc.status === "changed" || desc.status === "missing_in_scrunch" || desc.status === "only_in_scrunch" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Sheet</p>
                  <p className="mt-1 max-h-24 overflow-auto text-xs text-zinc-700 whitespace-pre-wrap">
                    {desc.sheet || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Scrunch</p>
                  <p className="mt-1 max-h-24 overflow-auto text-xs text-zinc-700 whitespace-pre-wrap">
                    {desc.live || "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-600 line-clamp-2">{desc.sheet || desc.live || "—"}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {desc.status === "missing_in_scrunch" || desc.status === "changed" ? (
                <ActionBtn
                  label="Update Scrunch"
                  busy={busy}
                  tone="accent"
                  onClick={() => onSync({ type: "push_description" })}
                />
              ) : null}
              {desc.status === "only_in_scrunch" || desc.status === "changed" ? (
                <ActionBtn
                  label="Pull to sheet"
                  busy={busy}
                  onClick={() => onSync({ type: "pull_description" })}
                />
              ) : null}
            </div>
          </section>

          <DiffSection
            title="Personas"
            summary={`${diff.counts.personasMissing} missing · ${diff.counts.personasOnlyLive} only in Scrunch · ${diff.counts.personasChanged} different`}
            onPushAll={
              diff.counts.personasMissing
                ? () => onSync({ type: "push_all_missing", section: "personas" })
                : undefined
            }
            busy={busy}
          >
            {diff.personas.map((p) => (
              <PersonaRow key={p.key} item={p} busy={busy} onSync={onSync} />
            ))}
          </DiffSection>

          <DiffSection
            title="Competitors"
            summary={`${diff.counts.competitorsMissing} missing · ${diff.counts.competitorsOnlyLive} only in Scrunch`}
            onPushAll={
              diff.counts.competitorsMissing
                ? () => onSync({ type: "push_all_missing", section: "competitors" })
                : undefined
            }
            busy={busy}
          >
            {diff.competitors.map((c) => (
              <CompetitorRow key={c.key} item={c} busy={busy} onSync={onSync} />
            ))}
          </DiffSection>

          <DiffSection
            title="Topics"
            summary={`${diff.counts.topicsMissing} missing · ${diff.counts.topicsOnlyLive} only in Scrunch`}
            onPushAll={
              diff.counts.topicsMissing
                ? () => onSync({ type: "push_all_missing", section: "topics" })
                : undefined
            }
            busy={busy}
          >
            {diff.topics.map((t) => (
              <TopicRow key={t.key} item={t} busy={busy} onSync={onSync} />
            ))}
          </DiffSection>
        </>
      )}
    </div>
  );
}

function DiffSection({
  title,
  summary,
  children,
  onPushAll,
  busy,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  onPushAll?: () => void;
  busy: boolean;
}) {
  return (
    <section className="rounded-xl border border-white bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-xs text-zinc-500">{summary}</p>
        </div>
        {onPushAll ? (
          <ActionBtn label="Sync all missing" busy={busy} tone="accent" onClick={onPushAll} />
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-zinc-100">{children}</ul>
    </section>
  );
}

function PersonaRow({
  item,
  busy,
  onSync,
}: {
  item: ScrunchPersonaDiffItem;
  busy: boolean;
  onSync: (action: ScrunchSyncAction) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#1e1c22]">{item.name}</span>
          <Badge status={item.status} />
        </div>
        {item.status === "changed" ? (
          <p className="mt-1 text-xs text-zinc-500">
            Sheet and Scrunch descriptions differ
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {item.status === "missing_in_scrunch" ? (
          <>
            <ActionBtn
              label="Sync to Scrunch"
              tone="accent"
              busy={busy}
              onClick={() => onSync({ type: "push_persona", name: item.name })}
            />
            <ActionBtn
              label="Delete from sheet"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "remove_persona_local", name: item.name })}
            />
          </>
        ) : null}
        {item.status === "only_in_scrunch" && item.liveId != null ? (
          <>
            <ActionBtn
              label="Add to sheet"
              busy={busy}
              onClick={() => onSync({ type: "pull_persona", liveId: item.liveId! })}
            />
            <ActionBtn
              label="Delete in Scrunch"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "archive_persona", liveId: item.liveId! })}
            />
          </>
        ) : null}
        {item.status === "changed" && item.liveId != null ? (
          <>
            <ActionBtn
              label="Update Scrunch"
              tone="accent"
              busy={busy}
              onClick={() =>
                onSync({ type: "update_persona", liveId: item.liveId!, name: item.name })
              }
            />
            <ActionBtn
              label="Pull to sheet"
              busy={busy}
              onClick={() => onSync({ type: "pull_persona", liveId: item.liveId! })}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

function CompetitorRow({
  item,
  busy,
  onSync,
}: {
  item: ScrunchCompetitorDiffItem;
  busy: boolean;
  onSync: (action: ScrunchSyncAction) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#1e1c22]">{item.name}</span>
          <Badge status={item.status} />
        </div>
        {item.sheetWebsite || item.liveWebsites?.[0] ? (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {item.sheetWebsite || item.liveWebsites?.[0]}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {item.status === "missing_in_scrunch" ? (
          <>
            <ActionBtn
              label="Sync to Scrunch"
              tone="accent"
              busy={busy}
              onClick={() => onSync({ type: "push_competitor", name: item.name })}
            />
            <ActionBtn
              label="Delete from sheet"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "remove_competitor_local", name: item.name })}
            />
          </>
        ) : null}
        {item.status === "only_in_scrunch" && item.liveId != null ? (
          <>
            <ActionBtn
              label="Add to sheet"
              busy={busy}
              onClick={() => onSync({ type: "pull_competitor", liveId: item.liveId! })}
            />
            <ActionBtn
              label="Delete in Scrunch"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "archive_competitor", liveId: item.liveId! })}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

function TopicRow({
  item,
  busy,
  onSync,
}: {
  item: ScrunchTopicDiffItem;
  busy: boolean;
  onSync: (action: ScrunchSyncAction) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#1e1c22]">{item.name}</span>
          <Badge status={item.status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {item.status === "missing_in_scrunch" ? (
          <>
            <ActionBtn
              label="Sync to Scrunch"
              tone="accent"
              busy={busy}
              onClick={() => onSync({ type: "push_topic", name: item.name })}
            />
            <ActionBtn
              label="Delete from sheet"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "remove_topic_local", name: item.name })}
            />
          </>
        ) : null}
        {item.status === "only_in_scrunch" ? (
          <>
            <ActionBtn
              label="Add to sheet"
              busy={busy}
              onClick={() => onSync({ type: "pull_topic", name: item.name })}
            />
            <ActionBtn
              label="Delete in Scrunch"
              tone="danger"
              busy={busy}
              onClick={() => onSync({ type: "remove_topic_scrunch", name: item.name })}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}
