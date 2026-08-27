import { jsPDF } from "jspdf";
import type { AeoAuditReport, AeoLead, CitationPrompt, MentionRateRow, VisibilityBrief } from "@/lib/audit-types";
import { SITE } from "@/lib/site-config";

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;

export type ReportPdfInput = {
  brandName: string;
  website: string;
  lead?: Pick<AeoLead, "name" | "email" | "company">;
  citationPrompts: CitationPrompt[];
  mentionRates: MentionRateRow[];
  visibility?: VisibilityBrief | null;
  readiness?: string;
  readinessSummary?: string;
  description?: string;
  samplePrompts?: string[];
};

export function pdfInputFromReport(report: AeoAuditReport, lead?: AeoLead): ReportPdfInput {
  return {
    brandName: report.brandName,
    website: report.website,
    lead,
    citationPrompts: report.citationPrompts,
    mentionRates: report.mentionRates,
    visibility: report.visibility,
    readiness: report.readiness,
    readinessSummary: report.readinessSummary,
    description: report.description,
    samplePrompts: report.prompts.slice(0, 10).map((p) => p.prompt),
  };
}

export function reportPdfFilename(brandName: string): string {
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `tmf-${slug || "brand"}-ai-visibility-brief.pdf`;
}

export function buildReportPdf(input: ReportPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { brandName, website } = input;
  let y = MARGIN;

  const ink = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const line = (text: string, size = 11, gap = 6) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, PAGE_W - MARGIN * 2) as string[];
    for (const row of lines) {
      if (y > PAGE_H - 18) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(row, MARGIN, y);
      y += gap;
    }
  };

  doc.setFillColor(23, 20, 31);
  doc.rect(0, 0, PAGE_W, 52, "F");
  ink(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`AI VISIBILITY REPORT · PREPARED BY ${SITE.productName.toUpperCase()}`, MARGIN, 14);
  doc.setFontSize(22);
  doc.text(brandName.slice(0, 60), MARGIN, 28);
  doc.setFontSize(10);
  doc.text(
    `Research snapshot · ${new Date().toLocaleDateString()} · not a live 30-day monitor`,
    MARGIN,
    38,
  );
  if (input.lead?.email) {
    doc.text(`Prepared for ${input.lead.name} · ${input.lead.email}`, MARGIN, 45);
  }
  y = 62;
  ink(33, 33, 33);

  line(website, 10, 6);
  if (input.readiness) line(`AEO/GEO readiness: ${input.readiness}`, 12, 7);
  if (input.readinessSummary) line(input.readinessSummary, 11, 6);
  if (input.description) {
    y += 2;
    line(input.description, 11, 6);
  }

  y += 3;
  line("Prompts this site may be cited in", 13, 8);
  if (input.citationPrompts.length === 0) line("None captured for this run.", 11, 6);
  for (const item of input.citationPrompts) {
    line(`• ${item.prompt}`, 11, 6);
  }

  y += 3;
  line("Estimated mention rate", 13, 8);
  const ranked = [...input.mentionRates].sort((a, b) => b.estimatedPct - a.estimatedPct);
  if (ranked.length === 0) line("None captured for this run.", 11, 6);
  ranked.forEach((row, i) => {
    line(`${i + 1}. ${row.name}   ${Math.round(row.estimatedPct)}%`, 11, 6);
  });

  const vis = input.visibility;
  if (vis) {
    y += 3;
    line(`AI visibility score  ${vis.score.toFixed(1)} / 100`, 14, 8);
    line(
      `Presence ${vis.presencePct.toFixed(1)}%   Position ${vis.positionScore.toFixed(1)}   Citation share ${vis.citationSharePct.toFixed(1)}%   Sentiment ${vis.sentimentScore.toFixed(1)}`,
      11,
      7,
    );
    if (vis.headline) line(vis.headline, 11, 6);
    y += 2;
    line("Competitor AI presence", 13, 8);
    for (const row of vis.competitorPresence) {
      const you = row.isYou ? "  YOU" : "";
      const gap = row.isYou ? "" : `   gap ${row.gapPts.toFixed(1)} pts`;
      line(`${row.name}${you}   ${row.presencePct.toFixed(1)}%${gap}`, 11, 6);
    }
    y += 2;
    line("Prompts you're losing to competitors", 13, 8);
    for (const item of vis.lostPrompts) {
      line(`"${item.prompt}"`, 11, 6);
    }
    y += 2;
    line("Platform performance", 13, 8);
    for (const row of vis.platforms) {
      line(`${row.name}   ${row.presencePct.toFixed(1)}%   ${row.position}   ${row.sentiment}`, 11, 6);
    }
  }

  if (input.samplePrompts?.length) {
    y += 3;
    line("Sample buyer prompts", 13, 8);
    for (const prompt of input.samplePrompts) line(`• ${prompt}`, 10, 5);
  }

  y += 6;
  ink(110, 110, 110);
  line(
    `Estimated from public research. Live ${SITE.productName} reports track prompts over time. ${SITE.presenterName}${SITE.presenterEmail ? ` · ${SITE.presenterEmail}` : ""}`,
    9,
    5,
  );

  return doc;
}

export function downloadReportPdf(input: ReportPdfInput) {
  buildReportPdf(input).save(reportPdfFilename(input.brandName));
}

export function reportPdfBase64(input: ReportPdfInput): string {
  return buildReportPdf(input).output("datauristring").split(",")[1] ?? "";
}

/** @deprecated use downloadReportPdf */
export function downloadVisibilityPdf(input: {
  brandName: string;
  website: string;
  visibility: VisibilityBrief;
}) {
  downloadReportPdf({
    brandName: input.brandName,
    website: input.website,
    visibility: input.visibility,
    citationPrompts: [],
    mentionRates: [],
  });
}
