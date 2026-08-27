import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { SITE } from "@/lib/site-config";
import "./globals.css";

// Sitecore's brand typeface is DM Sans (per sitecore.com brand guidelines) — used for
// headings and body alike, differentiated by weight rather than a separate display face.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${SITE.tagline} · ${SITE.companyName} + ${SITE.productName}`,
  description: `${SITE.heroHeadline} ${SITE.heroHeadlineEmphasis} — a free AEO/GEO discoverability audit from ${SITE.companyName} and ${SITE.productName}, built for the ${SITE.eventName} booth.`,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
