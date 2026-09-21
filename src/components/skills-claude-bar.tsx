"use client";

import { useState } from "react";
import type { MarketingSkillDoc } from "@/lib/marketing-skills-types";
import { claudeSkillsZip, claudeSkillsZipFilename } from "@/lib/claude-skill";
import { SITE } from "@/lib/site-config";

function downloadClaudeSkillsZip(skills: MarketingSkillDoc[]) {
  const bytes = claudeSkillsZip(skills);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = claudeSkillsZipFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function skillsMailto(name: string, email: string, skills: MarketingSkillDoc[]): string {
  const subject = `Your ${SITE.productName} Claude marketing skills`;
  const body = `Hi ${name},

Here are the ${skills.length} AI marketing skills you picked at the ${SITE.companyName} + ${SITE.productName} stand. Attach the downloaded zip, then add the folders to Claude.

Claude.ai: Settings → Capabilities → Skills → upload each folder.
Claude Code: copy each folder to ~/.claude/skills/

${skills.map((skill) => `- ${skill.name.replace(/_/g, " ")}`).join("\n")}

${SITE.presenterName}${SITE.presenterEmail ? `\n${SITE.presenterEmail}` : ""}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SkillsClaudeBar({
  selected,
  onClear,
  onSelectAll,
}: {
  selected: MarketingSkillDoc[];
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState<string>(SITE.defaultVisitorEmail);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onDownload() {
    setError(null);
    setMessage(null);
    if (selected.length === 0) return;
    downloadClaudeSkillsZip(selected);
    setMessage("Claude skill pack downloaded.");
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing-skills/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          skillIds: selected.map((skill) => skill.skillId),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        if (res.status === 503) {
          downloadClaudeSkillsZip(selected);
          const draft = document.createElement("a");
          draft.href = skillsMailto(name.trim() || "there", email.trim(), selected);
          draft.rel = "noreferrer";
          document.body.appendChild(draft);
          draft.click();
          draft.remove();
          setError(
            "Email sending isn't configured on this machine yet — the Claude pack was downloaded and your mail app should open so you can attach it.",
          );
          return;
        }
        throw new Error(data.error ?? "Could not send skills");
      }
      setMessage(`Sent ${selected.length} Claude skill${selected.length === 1 ? "" : "s"} to ${email.trim()}`);
      setOpen(false);
    } catch (err: unknown) {
      downloadClaudeSkillsZip(selected);
      setError(
        `${err instanceof Error ? err.message : String(err)} The Claude pack was downloaded so you can attach it yourself.`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (selected.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ece4ff] bg-white/95 px-4 py-3 shadow-[0_-12px_40px_-24px_rgba(67,0,173,0.35)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#212121]">
            {selected.length} skill{selected.length === 1 ? "" : "s"} selected for Claude
          </p>
          <p className="text-xs text-zinc-500">
            Download a ready-to-add skill pack, or email the zip.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-[0.625rem] border border-zinc-200 px-3 py-2 text-xs font-semibold"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-[0.625rem] border border-zinc-200 px-3 py-2 text-xs font-semibold"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-[0.625rem] border border-zinc-200 px-3 py-2 text-xs font-semibold"
          >
            Download for Claude
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[0.625rem] bg-[#212121] px-3 py-2 text-xs font-semibold text-white"
          >
            Email skills
          </button>
        </div>
      </div>
      {open ? (
        <form onSubmit={(e) => void onEmail(e)} className="mx-auto mt-3 grid max-w-6xl gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            required
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            type="email"
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            placeholder={SITE.defaultVisitorEmail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-[0.625rem] bg-[#6e3fff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send pack"}
          </button>
        </form>
      ) : null}
      {message ? <p className="mx-auto mt-2 max-w-6xl text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mx-auto mt-2 max-w-6xl text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
