import type { Metadata } from "next";
import { AuditWorkspace } from "@/components/audit/audit-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getAuditorTrail, listAuditEntries } from "@/lib/workflows/audit-explorer";
import { auditFilterSchema } from "@/lib/workflows/validation";

export const metadata: Metadata = { title: "Audit" };

type SearchParams = {
  focus?: string;
  query?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = requirePermission("audit:view");
  const rawFilters = Object.fromEntries(
    Object.entries(searchParams).filter(([name, value]) => name !== "focus" && Boolean(value)),
  );
  const filters = auditFilterSchema.parse(rawFilters);
  const entries = listAuditEntries(user.factoryId, filters);

  return (
    <AuditWorkspace
      initialEntries={entries}
      initialTrail={searchParams.focus ? getAuditorTrail(user.factoryId, searchParams.focus) : null}
      focus={searchParams.focus}
    />
  );
}
