"use client";

import { useState } from "react";
import type { MarketingSkillDoc } from "@/lib/marketing-skills-types";
import { claudeSkillsZip, claudeSkillsZipFilename } from "@/lib/claude-skill";

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

export function SkillsClaudeBar({
  selected,
  onClear,
  onSelectAll,
}: {
  selected: MarketingSkillDoc[];
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  function onDownload() {
    if (selected.length === 0) return;
    downloadClaudeSkillsZip(selected);
    setShowInstall(true);
    setMessage(
      `Downloaded ${selected.length} skill${selected.length === 1 ? "" : "s"}. Unzip, then add each folder to Claude.`,
    );
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
            Download a zip of standard Claude skill folders — each has a SKILL.md ready to upload.
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
            className="rounded-[0.625rem] bg-[#212121] px-3 py-2 text-xs font-semibold text-white"
          >
            Download for Claude
          </button>
          {/* Email sending is disabled.
          <button type="button">Email skills</button>
          */}
        </div>
      </div>
      {message ? <p className="mx-auto mt-2 max-w-6xl text-sm text-emerald-700">{message}</p> : null}
      {showInstall ? (
        <ol className="mx-auto mt-2 max-w-6xl list-decimal space-y-1 pl-5 text-xs leading-5 text-zinc-600">
          <li>Unzip the pack. Each folder is one skill.</li>
          <li>
            <strong>Claude.ai:</strong> Settings → Capabilities → Skills → Upload skill → choose a
            folder (or zip that folder).
          </li>
          <li>
            <strong>Claude Code:</strong> copy each folder into <code>~/.claude/skills/</code>{" "}
            (Windows: <code>%USERPROFILE%\.claude\skills\</code>), then start a new session.
          </li>
          <li>Ask Claude to use the skill by name.</li>
        </ol>
      ) : null}
    </div>
  );
}
