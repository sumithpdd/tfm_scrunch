"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site-config";

const links = [
  { href: "/", label: "Overview" },
  { href: "/audit", label: "Free audit" },
  { href: "/ai-marketing-skills", label: "AI marketing skills" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[radial-gradient(circle_at_top,#f5f0ff_0%,#f7f0f5_28%,#f7f7f7_58%,#ffffff_100%)] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-[#ece4ff] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#ece4ff] bg-white px-3 py-2 shadow-[0_10px_28px_-20px_rgba(134,41,255,0.9)]">
              <Image
                src="/sitecore-ai-logo-mark-color.svg"
                alt={SITE.companyName}
                width={154}
                height={37}
                className="h-7 w-auto"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">
                {SITE.productName} · {SITE.companyName}
              </p>
              <p className="truncate text-sm text-zinc-600">{SITE.tagline}</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-2 sm:justify-end">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:py-10 lg:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-[0.625rem] border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-[#4715af] bg-[#212121] text-white shadow-[0_12px_30px_-18px_rgba(134,41,255,0.9)]"
          : "border-[#ece4ff] bg-white/90 text-zinc-700 hover:border-[#d7c8ff] hover:bg-white"
      }`}
    >
      {children}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[#ece4ff] bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>
          {SITE.companyName} + {SITE.productName} — a free, research-based AEO/GEO audit. Not a live
          citation monitor.
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-zinc-800">{SITE.presenterName}</span>
          {SITE.presenterEmail ? (
            <>
              <span aria-hidden>·</span>
              <a className="text-[#6e3fff] underline" href={`mailto:${SITE.presenterEmail}`}>
                {SITE.presenterEmail}
              </a>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <a
            className="text-[#6e3fff] underline"
            href={SITE.siteUrl}
            target="_blank"
            rel="noreferrer"
          >
            {SITE.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        </p>
      </div>
    </footer>
  );
}
