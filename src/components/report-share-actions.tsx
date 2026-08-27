"use client";

import { useState } from "react";
import type { AeoAuditReport, AeoLead } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";
import { downloadReportPdf, pdfInputFromReport } from "@/lib/report-pdf";

function reportMailto(lead: AeoLead, report: AeoAuditReport): string {
  const subject = `Your ${SITE.productName} AI visibility brief — ${report.brandName}`;
  const body = `Hi ${lead.name},

Please find your research-based AI visibility brief for ${report.brandName} from the ${SITE.companyName} + ${SITE.productName} stand at ${SITE.eventName}.

The PDF downloaded from the booth tool is ready to attach.

This is a light-touch estimate, not a live 30-day Scrunch monitor.

${SITE.presenterName}${SITE.presenterEmail ? `\n${SITE.presenterEmail}` : ""}`;
  const cc = SITE.presenterEmail
    ? `&cc=${encodeURIComponent(SITE.presenterEmail)}`
    : "";
  return `mailto:${encodeURIComponent(lead.email)}${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ReportShareActions({
  report,
  lead,
  layout = "row",
}: {
  report: AeoAuditReport;
  lead: AeoLead;
  layout?: "row" | "stack";
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onDownload() {
    downloadReportPdf(pdfInputFromReport(report, lead));
  }

  async function onEmail() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/audit/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, report }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        if (res.status === 503) {
          downloadReportPdf(pdfInputFromReport(report, lead));
          const draft = document.createElement("a");
          draft.href = reportMailto(lead, report);
          draft.rel = "noreferrer";
          document.body.appendChild(draft);
          draft.click();
          draft.remove();
          setError(
            "Email sending isn't configured on this machine yet — the PDF was downloaded and your mail app should open so you can attach it.",
          );
          return;
        }
        throw new Error(data.error ?? "Could not send email");
      }
      setMessage(`Sent to ${lead.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${msg} The PDF was downloaded so you can attach it yourself.`);
      downloadReportPdf(pdfInputFromReport(report, lead));
    } finally {
      setBusy(false);
    }
  }

  const stacked = layout === "stack";

  return (
    <div className={stacked ? "flex flex-col gap-3" : "space-y-2"}>
      <div className={stacked ? "flex flex-col gap-3" : "flex flex-wrap gap-3"}>
        <button
          type="button"
          onClick={onDownload}
          className={
            stacked
              ? "w-full rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-[#212121]"
              : "rounded-[0.625rem] border border-zinc-200 px-5 py-2.5 text-sm font-semibold"
          }
        >
          Download PDF
        </button>
        <button
          type="button"
          disabled={busy || !lead.email.trim()}
          onClick={() => void onEmail()}
          className={
            stacked
              ? "w-full rounded-full bg-[#212121] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              : "rounded-[0.625rem] bg-[#212121] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          }
        >
          {busy ? "Sending…" : "Send me an email"}
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
