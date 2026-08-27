import type { Metadata } from "next";
import { StandDeskView } from "@/components/stand-desk-view";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Stand desk · ${SITE.companyName} + ${SITE.productName}`,
  robots: { index: false, follow: false },
};

export default function StandDeskPage() {
  return <StandDeskView />;
}
