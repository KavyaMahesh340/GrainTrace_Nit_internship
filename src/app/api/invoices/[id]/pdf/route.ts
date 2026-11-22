import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";
import { requireApiActor } from "@/lib/workflows/api";
import { getInvoicePdfData } from "@/lib/workflows/invoices";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("invoices:view");
  if (actor instanceof NextResponse) return actor;
  const invoiceNumber = decodeURIComponent(params.id);
  const data = getInvoicePdfData(actor.factoryId, invoiceNumber);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }

  const element = createElement(InvoicePdfDocument, { data }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);
  const fileName = `${invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
