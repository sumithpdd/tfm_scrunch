"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketingSkillDoc } from "@/lib/marketing-skills-types";
import { claudeSkillMarkdown } from "@/lib/claude-skill";

type Props = {
  skill: MarketingSkillDoc;
  onClose: () => void;
};

function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

/** Read-only viewer — this microsite has no login/auth layer, so skills ship in code only. */
export function MarketingSkillModal({ skill, onClose }: Props) {
  const [copied, setCopied] = useState<"prompt" | "claude" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    await copyText(skill.systemPrompt);
    setCopied("prompt");
    setTimeout(() => setCopied(null), 2000);
  }, [skill.systemPrompt]);

  const handleCopyClaude = useCallback(async () => {
    await copyText(claudeSkillMarkdown(skill));
    setCopied("claude");
    setTimeout(() => setCopied(null), 2000);
  }, [skill]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="skill-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  🔍
                </span>
                <h2 id="skill-modal-title" className="truncate font-mono text-lg font-semibold text-[#212121]">
                  {skill.name}
                </h2>
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                {skill.categoryLabel}
                <span className="text-zinc-400">· Claude skill</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
            >
              Close
            </button>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-600">{skill.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Trigger</dt>
              <dd className="mt-0.5 font-medium text-zinc-800">{skill.triggerLabel}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Tools</dt>
              <dd className="mt-0.5 font-medium text-zinc-800">
                {skill.tools.length > 0 ? `${skill.tools.length} connected` : "None"}
              </dd>
            </div>
          </dl>
        </div>

        {skill.tools.length > 0 && (
          <div className="border-b border-zinc-100 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Tools / MCP
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {skill.tools.map((tool) => (
                <li
                  key={tool.toolId}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                >
                  {tool.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              System prompt
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  copied === "prompt"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {copied === "prompt" ? "Copied" : "Copy prompt"}
              </button>
              <button
                type="button"
                onClick={handleCopyClaude}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  copied === "claude"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {copied === "claude" ? "Copied" : "Copy Claude skill"}
              </button>
            </div>
          </div>
          <pre className="max-h-64 flex-1 overflow-auto rounded-xl border border-zinc-800 bg-[#282828] p-4 font-mono text-xs leading-6 text-zinc-100 whitespace-pre-wrap">
            {skill.systemPrompt}
          </pre>
        </div>
      </div>
    </div>
  );
}
