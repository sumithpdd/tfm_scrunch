import { NextRequest, NextResponse } from "next/server";
import { generateAeoAudit } from "@/server/audit/audit.service";
import { logLead } from "@/server/audit/lead-log";
import { saveVisibilityReport } from "@/server/audit/report-store";
import { logAuditEvent } from "@/server/audit/event-log";
import type { GenerateAuditRequest } from "@/lib/audit-types";
import { snapshotFromReport } from "@/lib/audit-types";
import { parseBoothEventCode } from "@/lib/booth-events";
import { parseExtraUrls, type AuditStreamEvent } from "@/lib/audit-progress";
import { emailLooksValid, normalizeEmail } from "@/lib/email";
import { SITE } from "@/lib/site-config";
import { clientIp, hitRateLimit, userAgent } from "@/server/security/rate-limit";
import { verifyTurnstileToken } from "@/server/security/turnstile";

export const maxDuration = 60;

const MAX_BODY_BYTES = 24_000;

function streamResponse(write: (emit: (event: AuditStreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AuditStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await write(emit);
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        emit({ type: "error", error });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const ip = clientIp(request);
  const ua = userAgent(request);

  if (hitRateLimit(`audit:ip:min:${ip}`, 3, 60_000) || hitRateLimit(`audit:ip:hour:${ip}`, 12, 60 * 60_000)) {
    await logAuditEvent({ outcome: "blocked_rate", ip, userAgent: ua, error: "ip" });
    return NextResponse.json(
      { success: false, error: "Too many audits from this device. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: Partial<GenerateAuditRequest>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      await logAuditEvent({ outcome: "blocked_validation", ip, userAgent: ua, error: "body too large" });
      return NextResponse.json({ success: false, error: "Request is too large." }, { status: 413 });
    }
    body = JSON.parse(raw) as Partial<GenerateAuditRequest>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const brandName = body.brandName?.trim() ?? "";
  const website = body.website?.trim() ?? "";
  const extraUrls = parseExtraUrls(body.extraUrls);
  const lead = body.lead;
  const name = lead?.name?.trim() ?? "";
  const company = lead?.company?.trim() || brandName;
  const email = normalizeEmail(lead?.email ?? "");

  if (body.websiteConfirm?.trim()) {
    await logAuditEvent({
      outcome: "blocked_honeypot",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
    });
    return NextResponse.json({ success: false, error: "Could not start the audit. Try again." }, { status: 400 });
  }

  if (!brandName || !website || !name || !company) {
    await logAuditEvent({
      outcome: "blocked_validation",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      error: "missing fields",
    });
    return NextResponse.json(
      { success: false, error: "Name, work email, company, and website are required." },
      { status: 400 },
    );
  }
  if (!emailLooksValid(email)) {
    await logAuditEvent({
      outcome: "blocked_validation",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      error: "email",
    });
    return NextResponse.json({ success: false, error: "Enter a valid work email." }, { status: 400 });
  }
  const placeholderEmail = String(SITE.defaultVisitorEmail).trim().toLowerCase();
  if (placeholderEmail && email === placeholderEmail) {
    return NextResponse.json({ success: false, error: "Enter your own work email." }, { status: 400 });
  }
  if (body.consentAccepted !== true) {
    return NextResponse.json({ success: false, error: SITE.consentLabel }, { status: 400 });
  }

  if (hitRateLimit(`audit:email:hour:${email}`, 4, 60 * 60_000)) {
    await logAuditEvent({
      outcome: "blocked_rate",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      error: "email",
    });
    return NextResponse.json(
      { success: false, error: "That email has run several audits already. Try again later." },
      { status: 429 },
    );
  }

  const captcha = await verifyTurnstileToken(body.captchaToken, ip);
  if (!captcha.ok) {
    await logAuditEvent({
      outcome: "blocked_captcha",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      error: captcha.error,
    });
    return NextResponse.json({ success: false, error: captcha.error }, { status: 403 });
  }

  const eventCode = parseBoothEventCode(body.eventCode || SITE.eventCode);

  return streamResponse(async (emit) => {
    emit({ type: "stage", id: "validate", label: "Checking your details", detail: company });
    await logAuditEvent({
      outcome: "started",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      extraUrls,
    });

    const { report, error } = await generateAeoAudit({
      brandName,
      website,
      extraUrls,
      onProgress: (event) =>
        emit({
          type: "stage",
          id: event.id as "read_site",
          label: event.label,
          detail: event.detail,
        }),
    });

    if (error && report.source === "fallback") {
      await logAuditEvent({
        outcome: "failed",
        ip,
        userAgent: ua,
        name,
        email,
        company,
        website,
        extraUrls,
        error,
        durationMs: Date.now() - started,
      });
      emit({ type: "error", error });
      return;
    }

    emit({ type: "stage", id: "save", label: "Saving your audit" });
    await logLead(
      { name, company, email },
      brandName,
      website,
      snapshotFromReport(report),
      eventCode,
    );
    await saveVisibilityReport({
      lead: { name, company, email },
      brandName,
      website,
      report,
    });
    await logAuditEvent({
      outcome: "completed",
      ip,
      userAgent: ua,
      name,
      email,
      company,
      website,
      extraUrls,
      durationMs: Date.now() - started,
    });
    emit({ type: "stage", id: "done", label: "Ready" });
    emit({ type: "done", report });
  });
}
