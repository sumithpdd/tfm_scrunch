import type { Metadata } from "next";
import { AuditEventsView } from "@/components/audit-events-view";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Audit log · ${SITE.companyName} + ${SITE.productName}`,
  robots: { index: false, follow: false },
};

export default function StandDeskEventsPage() {
  return <AuditEventsView />;
}
