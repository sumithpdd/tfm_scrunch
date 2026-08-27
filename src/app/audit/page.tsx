import { Suspense } from "react";
import { AuditWorkspace } from "@/components/audit-workspace";

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditWorkspace />
    </Suspense>
  );
}
