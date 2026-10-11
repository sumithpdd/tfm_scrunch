import type { AeoAuditReport } from "@/lib/audit-types";
import type { AuditStageEvent, AuditStreamEvent } from "@/lib/audit-progress";

export async function readAuditGenerateStream(
  res: Response,
  onStage: (event: AuditStageEvent) => void,
): Promise<AeoAuditReport> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("ndjson")) {
    const data = (await res.json()) as { success?: boolean; error?: string; report?: AeoAuditReport };
    if (!res.ok || !data.success || !data.report) {
      throw new Error(data.error ?? "Audit failed");
    }
    return data.report;
  }

  if (!res.body) throw new Error("Audit stream was empty.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let report: AeoAuditReport | null = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: AuditStreamEvent;
      try {
        event = JSON.parse(trimmed) as AuditStreamEvent;
      } catch {
        continue;
      }
      if (event.type === "stage") onStage(event);
      if (event.type === "done") report = event.report as AeoAuditReport;
      if (event.type === "error") streamError = event.error;
    }
  }

  if (streamError) throw new Error(streamError);
  if (!res.ok) throw new Error(streamError ?? "Audit failed");
  if (!report) throw new Error("The audit finished without a report. Try again.");
  return report;
}
