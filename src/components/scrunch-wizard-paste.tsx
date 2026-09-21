"use client";

import { useState } from "react";
import type { ScrunchBrandSetupDoc } from "@/lib/scrunch-setup-types";

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

function CopyField({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1e1c22]">{label}</p>
          {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold"
          onClick={() => {
            void copy(value).then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1500);
            });
          }}
        >
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-zinc-800">
        {value || "—"}
      </pre>
    </div>
  );
}

export function ScrunchWizardPaste({ doc }: { doc: ScrunchBrandSetupDoc }) {
  const altNames = doc.alternativeNames.map((a) => a.name).join("\n");
  const altSites = doc.alternativeWebsites.map((a) => a.url).join("\n");
  const topicChips = doc.topics.map((t) => t.name).join("\n");
  const country = doc.primaryCountryLabel || (doc.primaryCountry === "GB" ? "United Kingdom" : doc.primaryCountry);

  return (
    <section className="space-y-4 rounded-2xl border border-[#ece8f8] bg-white p-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">Copy into Scrunch wizard</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Sitecore - EMEA · Create a new brand. Paste one field at a time. Do not accept the
          auto-scan defaults — they often pick the wrong competitors and leave country as US.
        </p>
      </div>

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        Before the wizard
      </h3>
      <CopyField
        label="What type of brand?"
        hint="Prospect vs Customer is chosen first and cannot be changed later."
        value={doc.relationship === "prospect" ? "Prospect" : "Customer"}
      />

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        1 · Website
      </h3>
      <CopyField label="Website" hint="Triggers Analyzing…" value={doc.website} />

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        2 · Brand details
      </h3>
      <CopyField label="Brand name" value={doc.brandName} />
      <CopyField
        label="Brand description"
        hint="Paste over the generated description."
        value={doc.description}
      />
      <CopyField
        label="Primary country"
        hint="Wizard defaults to US and it is not retroactive."
        value={country}
      />
      <CopyField
        label="Alternative brand names"
        hint="Add each name in the wizard (up to 100)."
        value={altNames}
      />
      <CopyField
        label="Alternative brand websites"
        hint="Owned properties only — not Wikipedia or third-party training sites."
        value={altSites}
      />

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        3 · Personas
      </h3>
      <p className="text-xs text-zinc-500">Remove scan proposals, then add these.</p>
      {doc.personas.map((p) => (
        <div key={p.name} className="grid gap-2 sm:grid-cols-2">
          <CopyField label="Persona name" value={p.name} />
          <CopyField label="Description" value={p.description} />
        </div>
      ))}

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        4 · Competitors
      </h3>
      {doc.competitors.map((c) => (
        <div key={c.name} className="space-y-2 rounded-xl border border-zinc-100 p-3">
          <CopyField label="Competitor name" value={c.name} />
          <CopyField label="Alternative names" value={c.altNames} />
          <CopyField label="Domains" value={c.website} />
        </div>
      ))}

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        5 · Topics
      </h3>
      <CopyField
        label="Key topics"
        hint="Add as chips. No commas inside a topic name."
        value={topicChips}
      />

      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8629ff]">
        6 · Review
      </h3>
      <CopyField
        label="Review checklist"
        value={[
          `Type: ${doc.relationship === "prospect" ? "Prospect" : "Customer"}`,
          `Name: ${doc.brandName}`,
          `Country: ${country} (must not be US)`,
          `Personas (${doc.personas.length}): ${doc.personas.map((p) => p.name).join(", ")}`,
          `Competitors (${doc.competitors.length}): ${doc.competitors.map((c) => c.name).join(", ")}`,
          `Topics (${doc.topics.length}): ${doc.topics.map((t) => t.name).join(", ")}`,
          "Then Create brand. Exit the prompt-generation wizard via Prompt Templates, then Import CSV.",
        ].join("\n")}
      />
    </section>
  );
}
