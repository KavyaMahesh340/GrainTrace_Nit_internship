import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPaise } from "@/domain";
import type { InvoicePdfData } from "@/lib/workflows/invoices";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#F2F1EB",
    color: "#171A18",
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 36,
  },
  header: {
    backgroundColor: "#171A18",
    color: "#F2F1EB",
    padding: 22,
    marginBottom: 18,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: 3 },
  tagline: { color: "#C8F169", fontSize: 8, marginTop: 5 },
  invoiceLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 2, textAlign: "right" },
  invoiceNumber: { fontFamily: "Courier", fontSize: 13, marginTop: 6, textAlign: "right" },
  headerGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  headerMeta: { maxWidth: 220 },
  metaLabel: { color: "#888E87", fontSize: 7, letterSpacing: 1.2, marginBottom: 3 },
  metaValue: { fontFamily: "Courier", fontSize: 8, lineHeight: 1.5 },
  parties: { flexDirection: "row", gap: 18, marginBottom: 18 },
  party: { flexGrow: 1, borderTopWidth: 2, borderTopColor: "#171A18", paddingTop: 10 },
  partyLabel: { color: "#888E87", fontSize: 7, letterSpacing: 1.2, marginBottom: 6 },
  partyLabelSpaced: { marginTop: 12 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  partyLine: { fontSize: 8, lineHeight: 1.5, color: "#243D31" },
  table: { borderWidth: 1, borderColor: "#888E87", marginBottom: 14 },
  tableHead: { flexDirection: "row", backgroundColor: "#243D31" },
  headCell: { color: "#F2F1EB", fontFamily: "Helvetica-Bold", fontSize: 7, padding: 7, letterSpacing: 0.6 },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#DADFD4" },
  cell: { padding: 7, fontSize: 8 },
  monoCell: { fontFamily: "Courier", fontSize: 7.5 },
  bottom: { flexDirection: "row", gap: 18 },
  summary: { width: 230, marginLeft: "auto" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { color: "#888E87" },
  summaryValue: { fontFamily: "Courier" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: "#171A18",
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontFamily: "Helvetica-Bold" },
  totalValue: { fontFamily: "Courier-Bold", fontSize: 11 },
  note: { marginTop: 16, borderLeftWidth: 3, borderLeftColor: "#C8F169", paddingLeft: 10, color: "#243D31" },
  status: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  cancelled: { color: "#C65D40" },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#888E87",
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: "#DADFD4",
    paddingTop: 8,
  },
});

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const isCancelled = data.status === "cancelled";
  const taxLabel = data.jurisdiction === "intra_state" ? "CGST + SGST" : "IGST";

  return (
    <Document title={`GRAINTRACE invoice ${data.invoiceNumber}`} author="GRAINTRACE">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.brand}>GRAINTRACE</Text>
              <Text style={styles.tagline}>EVERY PACKET PRODUCED. EVERY GRAM ACCOUNTED FOR.</Text>
            </View>
            <View>
              <Text style={styles.invoiceLabel}>TAX INVOICE</Text>
              <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            </View>
          </View>
          <View style={styles.headerGrid}>
            <View style={styles.headerMeta}>
              <Text style={styles.metaLabel}>FINANCIAL YEAR</Text>
              <Text style={styles.metaValue}>{data.financialYear}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaLabel}>INVOICE DATE</Text>
              <Text style={styles.metaValue}>{formatDate(data.invoiceDate)}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaLabel}>DUE DATE</Text>
              <Text style={styles.metaValue}>{formatDate(data.dueDate)}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaLabel}>STATUS</Text>
              <Text style={isCancelled ? [styles.status, styles.cancelled] : styles.status}>
                {data.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>FROM</Text>
            <Text style={styles.partyName}>{data.businessName}</Text>
            <Text style={styles.partyLine}>{data.businessAddress || "Factory address on file"}</Text>
            <Text style={styles.partyLine}>GSTIN {data.businessGstin || "Not provided"}</Text>
            <Text style={styles.partyLine}>State {data.fromState}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>BILL TO</Text>
            <Text style={styles.partyName}>{data.customerName}</Text>
            <Text style={styles.partyLine}>{data.customerAddress || "Customer address on file"}</Text>
            <Text style={styles.partyLine}>GSTIN {data.toGstin || "Not provided"}</Text>
            <Text style={styles.partyLine}>State {data.toState}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.headCell, { flex: 3 }]}>PRODUCT / HSN</Text>
            <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>QTY</Text>
            <Text style={[styles.headCell, { flex: 2, textAlign: "right" }]}>RATE</Text>
            <Text style={[styles.headCell, { flex: 2, textAlign: "right" }]}>TAXABLE</Text>
            <Text style={[styles.headCell, { flex: 2, textAlign: "right" }]}>{taxLabel}</Text>
            <Text style={[styles.headCell, { flex: 2, textAlign: "right" }]}>TOTAL</Text>
          </View>
          {data.lines.map((line) => (
            <View style={styles.tableRow} key={line.id}>
              <View style={{ flex: 3, padding: 7 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{line.productName}</Text>
                <Text style={{ fontFamily: "Courier", fontSize: 7, color: "#888E87", marginTop: 3 }}>
                  HSN {line.hsnCode}
                </Text>
              </View>
              <Text style={[styles.cell, styles.monoCell, { flex: 1, textAlign: "right" }]}>
                {line.quantityPackets}
              </Text>
              <Text style={[styles.cell, styles.monoCell, { flex: 2, textAlign: "right" }]}>
                {formatPaise(line.unitPricePaise)}
              </Text>
              <Text style={[styles.cell, styles.monoCell, { flex: 2, textAlign: "right" }]}>
                {formatPaise(line.taxablePaise)}
              </Text>
              <Text style={[styles.cell, styles.monoCell, { flex: 2, textAlign: "right" }]}>
                {formatPaise(line.taxPaise)}
              </Text>
              <Text style={[styles.cell, styles.monoCell, { flex: 2, textAlign: "right" }]}>
                {formatPaise(line.lineTotalPaise)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.bottom}>
          <View style={{ flexGrow: 1 }}>
            <Text style={styles.partyLabel}>PAYMENT TERMS</Text>
            <Text style={styles.partyLine}>{data.paymentTermsDays} days from invoice date</Text>
            <Text style={[styles.partyLabel, styles.partyLabelSpaced]}>TAX BASIS</Text>
            <Text style={styles.partyLine}>
              {data.jurisdiction === "intra_state" ? "Intrastate supply — CGST + SGST" : "Interstate supply — IGST"}
            </Text>
            {isCancelled ? (
              <View style={styles.note}>
                <Text style={[styles.status, styles.cancelled]}>CANCELLED — CREDIT NOTE {data.creditNoteNumber}</Text>
                <Text>{data.cancellationReason}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxable value</Text>
              <Text style={styles.summaryValue}>{formatPaise(data.subtotalPaise)}</Text>
            </View>
            {data.jurisdiction === "intra_state" ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>CGST</Text>
                  <Text style={styles.summaryValue}>{formatPaise(data.lines.reduce((sum, line) => sum + line.cgstPaise, 0))}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>SGST</Text>
                  <Text style={styles.summaryValue}>{formatPaise(data.lines.reduce((sum, line) => sum + line.sgstPaise, 0))}</Text>
                </View>
              </>
            ) : (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IGST</Text>
                <Text style={styles.summaryValue}>{formatPaise(data.lines.reduce((sum, line) => sum + line.igstPaise, 0))}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount paid</Text>
              <Text style={styles.summaryValue}>{formatPaise(data.amountPaidPaise)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={styles.summaryValue}>{formatPaise(data.outstandingPaise)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GRAND TOTAL</Text>
              <Text style={styles.totalValue}>{formatPaise(data.totalPaise)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>GRAINTRACE — MATERIAL JOURNEY ACCOUNTABILITY</Text>
          <Text render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
