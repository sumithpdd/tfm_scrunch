import { LeadCaptureHero } from "@/components/lead-capture-hero";
import { SITE } from "@/lib/site-config";

const proof = [
  {
    title: "Researched, not guessed",
    body: `${SITE.companyName} ${SITE.productName} reads your live homepage and public presence, then builds the audit from what it finds.`,
  },
  {
    title: "Built for AI search",
    body: `Covers how you'd likely show up across ${9} assistants — ChatGPT, Claude, Google AI Overviews, Perplexity, and more.`,
  },
  {
    title: "Yours to keep",
    body: "Personas, topics, competitors, and sample buyer prompts you can hand straight to your content team.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <LeadCaptureHero />

      <section>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">
            Why run it
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">
            A light-touch AEO/GEO read in minutes
          </h2>
        </div>
        <ul className="grid gap-5 md:grid-cols-3">
          {proof.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-[#ece4ff] bg-white p-6 shadow-[0_18px_45px_-32px_rgba(67,0,173,0.35)]"
            >
              <h3 className="font-serif text-lg font-semibold text-[#212121]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.75rem] border border-[#6e3fff]/20 bg-[#282828] p-8 text-white sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d2c1ff]">
          {SITE.productName} + {SITE.companyName}
        </p>
        <h2 className="mt-3 font-serif text-2xl font-semibold sm:text-3xl">
          Humans don&apos;t visit your website anymore — AI does.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
          {SITE.productName} gets your site AI-ready so you show up in answers, get cited, and grow
          revenue. Now part of {SITE.companyName}. This free audit is a research snapshot — the full
          product measures mention rate across assistants over time.
        </p>
      </section>
    </div>
  );
}
