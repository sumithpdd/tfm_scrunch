"use client";

import { useEffect, useState } from "react";
import { GENERATION_FACTS, GENERATION_STAGES } from "@/lib/generation-wait";
import { SITE } from "@/lib/site-config";

const FACT_MS = 4500;
const STAGE_MS = 5200;

export function useGenerationWait(active: boolean) {
  const [factIndex, setFactIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setFactIndex(0);
      setStageIndex(0);
      return;
    }
    const facts = window.setInterval(() => {
      setFactIndex((i) => (i + 1) % GENERATION_FACTS.length);
    }, FACT_MS);
    const stages = window.setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, GENERATION_STAGES.length - 1));
    }, STAGE_MS);
    return () => {
      window.clearInterval(facts);
      window.clearInterval(stages);
    };
  }, [active]);

  return {
    fact: GENERATION_FACTS[factIndex] ?? GENERATION_FACTS[0],
    stage: GENERATION_STAGES[stageIndex] ?? GENERATION_STAGES[0],
    factIndex,
    stageIndex,
  };
}

export function GenerationWaitPanel({
  active,
  compact = false,
  wait,
}: {
  active: boolean;
  compact?: boolean;
  wait?: ReturnType<typeof useGenerationWait>;
}) {
  const local = useGenerationWait(active && !wait);
  const { fact, stage, factIndex, stageIndex } = wait ?? local;
  if (!active) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#ece4ff] bg-gradient-to-br from-[#faf8ff] via-white to-[#fff6f3] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6e3fff] text-white">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6e3fff]">
            {SITE.companyName} {SITE.productName} is on it
          </p>
          <p className="mt-1 text-sm font-semibold text-[#212121]">{stage}</p>
          <div className="mt-2 flex gap-1.5">
            {GENERATION_STAGES.map((_, i) => (
              <span
                key={GENERATION_STAGES[i]}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= stageIndex ? "bg-[#6e3fff]" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div key={factIndex} className="mt-4 rounded-xl border border-[#ece4ff] bg-white/80 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#EB001A]">
          While you wait · {fact.kicker}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-zinc-700">{fact.body}</p>
      </div>
    </div>
  );
}

export function GenerationButtonLabel({
  busy,
  idle,
  rerun,
  hasResult,
}: {
  busy: boolean;
  idle: string;
  rerun: string;
  hasResult: boolean;
}) {
  const { stage } = useGenerationWait(busy);
  if (busy) return <>{stage}</>;
  return <>{hasResult ? rerun : idle}</>;
}
