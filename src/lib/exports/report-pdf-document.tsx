import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportDefinition } from "@/lib/workflows/reports";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 7,
    fontFamily: "Helvetica",
    color: "#16231d",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#2f6a4d",
  },
  brand: { fontSize: 9, color: "#2f6a4d", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 700 },
  meta: { marginTop: 4, color: "#5b6a62" },
  table: { borderWidth: 1, borderColor: "#d4ddd6" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#1d2b25",
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5eae6",
  },
  alternate: { backgroundColor: "#f5f8f5" },
  cell: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 2, overflow: "hidden" },
  headerCell: { color: "#ffffff", fontWeight: 700 },
  summaries: { marginTop: 14, flexDirection: "row", flexWrap: "wrap" },
  summary: { width: "33%", padding: 6, marginBottom: 6, backgroundColor: "#eef4ef" },
  summaryLabel: { fontSize: 6, color: "#5b6a62" },
  summaryValue: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#5b6a62",
  },
});

type PdfRow = string[];

type Props = {
  title?: string;
  author?: string;
  report: ReportDefinition;
  headers: string[];
  rows: PdfRow[];
};

export function ReportPdfDocument({ report, headers, rows, title, author }: Props) {
  return (
    <Document title={title ?? `GrainTrace · ${report.label}`} author={author ?? "GrainTrace"}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>GRAINTRACE · OPERATIONS INTELLIGENCE</Text>
          <Text style={styles.title}>{report.label}</Text>
          <Text style={styles.meta}>
            {`Generated ${report.generatedAt} · ${report.rows.length} rows · ${report.description}`}
          </Text>
        </View>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {headers.map((header, index) => (
              <Text key={`${header}-${index}`} style={[styles.cell, styles.headerCell]}>
                {header}
              </Text>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[styles.row, rowIndex % 2 === 1 ? styles.alternate : undefined]}
              wrap={false}
            >
              {row.map((cell, cellIndex) => (
                <Text key={`cell-${cellIndex}`} style={styles.cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.summaries}>
          {report.summaries.map((summary) => (
            <View key={summary.label} style={styles.summary}>
              <Text style={styles.summaryLabel}>{summary.label.toUpperCase()}</Text>
              <Text style={styles.summaryValue}>{summary.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer} fixed>
          <Text>GrainTrace · {report.key}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
