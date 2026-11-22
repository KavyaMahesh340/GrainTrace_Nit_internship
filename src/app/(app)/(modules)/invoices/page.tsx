import type { Metadata } from "next";
import { InvoicesWorkspace } from "@/components/sales/invoices-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getInvoiceOptions, listInvoices } from "@/lib/workflows/invoices";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("invoices:view");
  const today = new Date().toISOString().slice(0, 10);
  const invoices = listInvoices(user.factoryId);

  return (
    <InvoicesWorkspace
      initialInvoices={invoices}
      overview={{
        posted: invoices.filter((invoice) => invoice.status !== "cancelled").length,
        outstandingPaise: invoices.reduce((sum, invoice) => sum + invoice.outstandingPaise, 0),
        overdue: invoices.filter((invoice) => invoice.status !== "cancelled" && invoice.dueDate < today).length,
        cancelled: invoices.filter((invoice) => invoice.status === "cancelled").length,
      }}
      orders={getInvoiceOptions(user.factoryId).orders}
      canManage={user.permissions.includes("invoices:manage")}
      focus={searchParams.focus}
    />
  );
}
