import type { Metadata } from "next";
import { StandDeskSettingsView } from "@/components/stand-desk-settings-view";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Settings · ${SITE.companyName} + ${SITE.productName}`,
  robots: { index: false, follow: false },
};

export default function StandDeskSettingsPage() {
  return <StandDeskSettingsView />;
}
