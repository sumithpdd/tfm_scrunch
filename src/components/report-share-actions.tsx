"use client";

import { useEffect, useState } from "react";
import type { AeoAuditReport, AeoLead } from "@/lib/audit-types";
import { downloadReportPdf, pdfInputFromReport } from "@/lib/report-pdf";

export function ReportShareActions({
  report,
  lead,
  layout = "row",
}: {
  report: AeoAuditReport;
  lead: AeoLead;
  layout?: "row" | "stack";
}) {
  const [email, setEmail] = useState(lead.email);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(lead.email);
  }, [lead.email]);

  function onDownload() {
    setError(null);
    setMessage(null);
    try {
      downloadReportPdf(pdfInputFromReport(report, { ...lead, email: email.trim() }));
      setMessage("PDF downloaded.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF.");
    }
  }

  /*
  Email sending is disabled until a Sitecore-approved sender is configured.
  async function onEmail() { fetch("/api/audit/email", ...) }
  */

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
        {/* <button type="button" onClick={() => void onEmail()}>Send email</button> */}
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
