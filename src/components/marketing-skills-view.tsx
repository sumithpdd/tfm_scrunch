"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MarketingSkillDoc } from "@/lib/marketing-skills-types";
import { SCRUNCH_BLOG_URL, SCRUNCH_HOME_URL } from "@/lib/marketing-skills-seed";
import { MarketingSkillModal } from "@/components/marketing-skill-modal";
import { SITE } from "@/lib/site-config";

const CATEGORY_DOT: Record<string, string> = {
  purple: "bg-violet-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  violet: "bg-[#6e3fff]",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
};

function groupByCategory(skills: MarketingSkillDoc[]) {
  const map = new Map<string, { label: string; skills: MarketingSkillDoc[] }>();
  for (const skill of skills) {
    const g = map.get(skill.categoryId);
    if (g) g.skills.push(skill);
    else map.set(skill.categoryId, { label: skill.categoryLabel, skills: [skill] });
  }
  return [...map.values()];
}

export function MarketingSkillsView() {
  const [skills, setSkills] = useState<MarketingSkillDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketingSkillDoc | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing-skills");
      const data = await res.json();
      if (data.success) setSkills(data.skills);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to a microtask so this doesn't setState synchronously inside the effect body.
    queueMicrotask(() => void load());
  }, [load]);

  const categories = groupByCategory(skills);
  const categoryFilters = [
    { id: "all", label: "All" },
    ...categories.map((c) => ({ id: c.skills[0]?.categoryId ?? "", label: c.label })),
  ];

  const filtered = filter === "all" ? skills : skills.filter((s) => s.categoryId === filter);
  const filteredGroups = groupByCategory(filtered);

  return (
    <div className="space-y-14">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">
          {SITE.productName} + {SITE.companyName}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#212121] sm:text-5xl">
          AI Marketing Skills
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
          A working prompt library — real agent skills with triggers, connected tools, and system
          prompts you can copy and use today.
        </p>
        <p className="mt-2 text-sm font-medium text-zinc-500">
          {loading ? "Loading…" : `${skills.length} marketing skills`}
        </p>
      </header>

      <section className="overflow-hidden rounded-[1.75rem] border border-[#EB001A]/25 bg-gradient-to-br from-[#fdf1f2] via-white to-[#f5f0ff] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#EB001A]">
              {SITE.productName} + {SITE.companyName}
            </p>
            <h2 className="font-serif text-2xl font-semibold text-[#212121] sm:text-3xl">
              The AI customer experience platform
            </h2>
            <p className="text-sm leading-7 text-zinc-700">
              Humans don&apos;t visit your website anymore — AI does.{" "}
              <a
                href={SCRUNCH_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#212121] underline decoration-[#EB001A]/50 underline-offset-2 hover:decoration-[#EB001A]"
              >
                {SITE.productName}
              </a>{" "}
              gets your site AI-ready so you show up in answers, get cited, and grow revenue. Now
              part of {SITE.companyName}.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={SCRUNCH_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[0.625rem] border border-[#EB001A]/30 bg-white px-4 py-2 text-sm font-semibold text-[#212121] shadow-sm transition hover:border-[#EB001A]/50 hover:bg-[#fdeeee]"
              >
                scrunch.com →
              </a>
              <a
                href={SCRUNCH_BLOG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[0.625rem] border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-white"
              >
                {SITE.companyName} acquisition →
              </a>
            </div>
          </div>
          <ul className="grid shrink-0 gap-3 sm:grid-cols-2 lg:max-w-sm">
            {[
              "AXP — AI-optimized agent experience",
              "Monitoring & citations",
              "Agent traffic & site maps",
              "Insights & AI search trends",
            ].map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">
              Prompt library
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#212121]">
              Click a skill to view tools &amp; system prompt
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryFilters.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === cat.id
                    ? "bg-[#6e3fff] text-white"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-[#6e3fff]/30"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-zinc-100 bg-zinc-50" />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {filteredGroups.map((group) => (
              <div key={group.skills[0]?.categoryId}>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  <span
                    className={`h-2 w-2 rounded-full ${CATEGORY_DOT[group.skills[0]?.categoryColor ?? "purple"]}`}
                  />
                  {group.label}
                </h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.skills.map((skill) => (
                    <li key={skill.skillId}>
                      <button
                        type="button"
                        onClick={() => setSelected(skill)}
                        className="flex h-full w-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 text-left shadow-[0_12px_40px_-28px_rgba(30,28,34,0.35)] transition hover:border-[#6e3fff]/30 hover:shadow-[0_16px_48px_-24px_rgba(134,41,255,0.25)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-mono text-sm font-semibold text-[#212121]">{skill.name}</h4>
                          {skill.source === "dust" && (
                            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                              Dust
                            </span>
                          )}
                        </div>
                        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[skill.categoryColor]}`} />
                          {skill.categoryLabel}
                        </p>
                        <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 line-clamp-3">
                          {skill.description}
                        </p>
                        <p className="mt-4 text-xs font-medium text-zinc-400">
                          {skill.triggerLabel}
                          {skill.tools.length > 0 && ` · ${skill.tools.length} tools`}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-[#6e3fff]/20 bg-[#282828] p-8 text-center text-white">
        <h2 className="font-serif text-2xl font-semibold">Want your own free audit?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/72">
          Run the same research-driven engine on your own site — free, on the spot, no signup
          beyond your name and email.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[0.625rem] bg-[#6e3fff] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8a5cff]"
        >
          {SITE.ctaLabel}
        </Link>
      </section>

      {selected && <MarketingSkillModal skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
