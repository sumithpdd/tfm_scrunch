import { NextRequest, NextResponse } from "next/server";
import { forbiddenForAEs, getStandDeskRole } from "@/server/admin/stand-desk-auth";
import { getLeadByWebsite, upsertCompanyRecord } from "@/server/audit/lead-log";
import { MAX_SCRUNCH_PDF_BYTES, readScrunchPdf, saveScrunchPdf } from "@/server/audit/pdf-store";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  const website = request.nextUrl.searchParams.get("website")?.trim() ?? "";
  if (!website) {
    return NextResponse.json({ success: false, error: "Website is required." }, { status: 400 });
  }

  const lead = await getLeadByWebsite(website);
  if (role !== "super" && lead?.reportHidden) return forbiddenForAEs();

  const stored = await readScrunchPdf(website);
  if (!stored) {
    return NextResponse.json({ success: false, error: "No Scrunch PDF for this website." }, { status: 404 });
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const body = new Uint8Array(stored.buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${stored.filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const role = getStandDeskRole(request);
  if (!role) {
    return NextResponse.json({ success: false, error: "Unlock required." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const company = String(form.get("company") ?? "").trim();
    const website = String(form.get("website") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const eventCode = String(form.get("eventCode") ?? "").trim();
    const scrunchOrgId = String(form.get("scrunchOrgId") ?? "").trim();
    const scrunchBrandId = String(form.get("scrunchBrandId") ?? "").trim();
    const file = form.get("file");

    if (!company || !website) {
      return NextResponse.json({ success: false, error: "Company and website are required." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, error: "Choose a Scrunch PDF to upload." }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ success: false, error: "Upload a PDF file." }, { status: 400 });
    }
    if (file.size > MAX_SCRUNCH_PDF_BYTES) {
      return NextResponse.json({ success: false, error: "PDF must be 8 MB or smaller." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = file.name.replace(/[^\w.\- ()]+/g, "_") || "scrunch-report.pdf";
    const storagePath = await saveScrunchPdf(website, bytes, filename);
    const existing = await getLeadByWebsite(website);
    if (role !== "super" && existing?.reportHidden) return forbiddenForAEs();

    const lead = await upsertCompanyRecord({
      company,
      website,
      name,
      email,
      eventCode,
      scrunchOrgId: role === "super" ? scrunchOrgId : undefined,
      scrunchBrandId: role === "super" ? scrunchBrandId : undefined,
      scrunchPdf: { filename, storagePath },
    });

    return NextResponse.json({ success: true, lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
