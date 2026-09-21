import "server-only";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { PDFS_COLLECTION, PDFS_STORAGE_PREFIX } from "@/lib/tmf-store";
import { getAdminDb, isServerFirestoreAvailable } from "@/server/db/firestore-admin";
import { websiteDocId } from "@/server/audit/lead-log";

export const MAX_SCRUNCH_PDF_BYTES = 8 * 1024 * 1024;

export function scrunchPdfStoragePath(website: string): string {
  return `${PDFS_STORAGE_PREFIX}/${websiteDocId(website)}.pdf`;
}

function bucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}

export async function saveScrunchPdf(
  website: string,
  bytes: Buffer,
  filename: string,
): Promise<string> {
  if (bytes.length === 0) throw new Error("PDF file is empty.");
  if (bytes.length > MAX_SCRUNCH_PDF_BYTES) {
    throw new Error("PDF must be 8 MB or smaller.");
  }

  const storagePath = scrunchPdfStoragePath(website);
  try {
    await bucket()
      .file(storagePath)
      .save(bytes, {
        resumable: false,
        contentType: "application/pdf",
        metadata: {
          contentType: "application/pdf",
          metadata: { originalFilename: filename, website },
        },
      });
    return storagePath;
  } catch (err) {
    if (!isServerFirestoreAvailable() || bytes.length > 700_000) throw err;
    console.warn("[pdf-store] Storage write failed — saving PDF in Firestore fallback", err);
    await getAdminDb()
      .collection(PDFS_COLLECTION)
      .doc(websiteDocId(website))
      .set({
        website,
        filename,
        pdfBase64: bytes.toString("base64"),
        updatedAt: new Date().toISOString(),
      });
    return `firestore:${websiteDocId(website)}`;
  }
}

export async function readScrunchPdf(
  website: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const storagePath = scrunchPdfStoragePath(website);
  try {
    const file = bucket().file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
      const [buffer] = await file.download();
      const [meta] = await file.getMetadata();
      const filename =
        (meta.metadata?.originalFilename as string | undefined) || `${websiteDocId(website)}.pdf`;
      return { buffer, filename };
    }
  } catch (err) {
    console.warn("[pdf-store] Storage read failed", err);
  }

  if (!isServerFirestoreAvailable()) return null;
  const snap = await getAdminDb().collection(PDFS_COLLECTION).doc(websiteDocId(website)).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const pdfBase64 = String(data.pdfBase64 ?? "");
  if (!pdfBase64) return null;
  return {
    buffer: Buffer.from(pdfBase64, "base64"),
    filename: String(data.filename ?? `${websiteDocId(website)}.pdf`),
  };
}
