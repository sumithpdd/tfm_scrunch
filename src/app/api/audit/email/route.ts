import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { AeoAuditReport, AeoLead } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { pdfInputFromReport, reportPdfBytes, reportPdfFilename } from "@/lib/report-pdf";

export const maxDuration = 30;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return NextResponse.json(
      {
        success: false,
        error: "Email sending is not configured yet (RESEND_API_KEY and EMAIL_FROM).",
      },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many emails from this device — try again in a minute." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as { lead?: AeoLead; report?: AeoAuditReport };
    const lead = body.lead;
    const report = body.report;
    const to = lead?.email?.trim().toLowerCase() ?? "";

    if (!lead?.name?.trim() || !emailLooksValid(to) || !report?.brandName) {
      return NextResponse.json({ success: false, error: "Name, email, and a report are required." }, { status: 400 });
    }
    if (isRateLimited(`email:${to}`)) {
      return NextResponse.json(
        { success: false, error: "That inbox already received a report recently." },
        { status: 429 },
      );
    }

    const filename = reportPdfFilename(report.brandName);
    const pdf = reportPdfBytes(pdfInputFromReport(report, lead));
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      ...(SITE.presenterEmail
        ? { cc: SITE.presenterEmail, replyTo: SITE.presenterEmail }
        : {}),
      subject: `Your ${SITE.productName} AI visibility brief — ${report.brandName}`,
      html: `<p>Hi ${escapeHtml(lead.name.trim())},</p>
<p>Here's your research-based AI visibility brief for <strong>${escapeHtml(report.brandName)}</strong> from the ${escapeHtml(SITE.companyName)} + ${escapeHtml(SITE.productName)} stand at ${escapeHtml(SITE.eventName)}.</p>
<p>The PDF is attached. This is a light-touch estimate, not a live 30-day Scrunch monitor.</p>
<p>${escapeHtml(SITE.presenterName)}${SITE.presenterEmail ? `<br/>${escapeHtml(SITE.presenterEmail)}` : ""}</p>`,
      attachments: [
        {
          filename,
          content: Buffer.from(pdf),
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
