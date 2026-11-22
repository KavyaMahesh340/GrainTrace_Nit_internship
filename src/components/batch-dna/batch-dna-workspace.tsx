"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleDot,
  Database,
  FileText,
  FlaskConical,
  Layers,
  Package,
  Route,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise } from "@/domain";
import type {
  BatchDnaTrace,
  BatchDnaTraceSummary,
  TraceNode,
} from "@/lib/workflows/batch-dna";

type Props = {
  initialBatches: BatchDnaTraceSummary[];
  initialTrace: BatchDnaTrace | null;
  initialIdentifier?: string;
};

type Direction = "full" | "upstream" | "downstream";

const stages = [
  { key: "sources", label: "Purchase sources", short: "Source" },
  { key: "lots", label: "Raw material lots", short: "Lots" },
  { key: "movements", label: "Inventory movements", short: "Ledger" },
  { key: "recipe", label: "Recipe / BOM", short: "Recipe" },
  { key: "run", label: "Production run", short: "Run" },
  { key: "consumption", label: "Material consumption", short: "Consume" },
  { key: "yield", label: "Yield / variance", short: "Yield" },
  { key: "finished", label: "Finished goods", short: "Finished" },
  { key: "dispatch", label: "Dispatch", short: "Dispatch" },
  { key: "invoice", label: "Invoice / customer", short: "Invoice" },
] as const;

async function apiRequest<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as { ok?: boolean; error?: string } & T;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "The trace could not be loaded.");
  }
  return data;
}

function fieldClass() {
  return "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function nodeIcon(kind: TraceNode["kind"]) {
  const className = "h-3.5 w-3.5";
  if (kind === "supplier") return <Truck className={className} aria-hidden="true" />;
  if (kind === "batch") return <Layers className={className} aria-hidden="true" />;
  if (kind === "ledger") return <Database className={className} aria-hidden="true" />;
  if (kind === "recipe") return <FlaskConical className={className} aria-hidden="true" />;
  if (kind === "run") return <Activity className={className} aria-hidden="true" />;
  if (kind === "consumption") return <ArrowDown className={className} aria-hidden="true" />;
  if (kind === "yield") return <AlertTriangle className={className} aria-hidden="true" />;
  if (kind === "finished") return <Package className={className} aria-hidden="true" />;
  if (kind === "dispatch") return <Route className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}

function statusVariant(status: string) {
  if (status === "posted" || status === "completed") return "default";
  if (status === "in_progress") return "machine";
  if (status === "planned") return "dark";
  return "outline";
}

export function BatchDnaWorkspace({ initialBatches, initialTrace, initialIdentifier }: Props) {
  const [batches, setBatches] = useState(initialBatches);
  const [trace, setTrace] = useState<BatchDnaTrace | null>(initialTrace);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<Direction>("full");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTrace?.nodes.find((node) => node.kind === "run")?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTrace(nextIdentifier: string) {
    if (!nextIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ trace: BatchDnaTrace }>(
        `/api/batch-dna/traces/${encodeURIComponent(nextIdentifier)}`,
      );
      setTrace(data.trace);
      setSelectedId(data.trace.nodes.find((node) => node.kind === "run")?.id ?? data.trace.nodes[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The batch trace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshBatches() {
    try {
      const data = await apiRequest<{ batches: BatchDnaTraceSummary[] }>("/api/batch-dna/traces");
      setBatches(data.batches);
    } catch {
      setBatches((current) => current);
    }
  }

  useEffect(() => {
    if (initialIdentifier && initialIdentifier !== initialTrace?.batchCode) {
      void loadTrace(initialIdentifier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIdentifier]);

  const filteredBatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return batches;
    return batches.filter((batch) =>
      [batch.batchCode, batch.runNumber, batch.productName, batch.productCode]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [batches, query]);

  const visibility = useMemo(() => {
    if (!trace) return { nodes: new Set<string>(), edges: new Set<string>() };
    if (direction === "full") {
      return {
        nodes: new Set(trace.nodes.map((node) => node.id)),
        edges: new Set(trace.edges.map((edge) => edge.id)),
      };
    }

    const forward = direction === "downstream";
    const root = trace.nodes.find((node) => node.kind === "run")?.id;
    const nodes = new Set<string>();
    const edges = new Set<string>();
    if (!root) return { nodes, edges };

    const queue = [root];
    nodes.add(root);
    while (queue.length > 0) {
      const cursor = queue.shift()!;
      for (const edge of trace.edges) {
        const matches = forward ? edge.from === cursor : edge.to === cursor;
        if (!matches) continue;
        edges.add(edge.id);
        const next = forward ? edge.to : edge.from;
        if (!nodes.has(next)) {
          nodes.add(next);
          queue.push(next);
        }
      }
    }
    return { nodes, edges };
  }, [direction, trace]);

  const selectedNode = trace?.nodes.find((node) => node.id === selectedId) ?? null;
  const activeRunNode = trace?.nodes.find((node) => node.kind === "run") ?? null;

  function inbound(nodeId: string) {
    return trace?.edges.filter((edge) => edge.to === nodeId && visibility.edges.has(edge.id)) ?? [];
  }

  function outbound(nodeId: string) {
    return trace?.edges.filter((edge) => edge.from === nodeId && visibility.edges.has(edge.id)) ?? [];
  }

  function edgeLabel(nodeId: string, edgeId: string) {
    const edge = trace?.edges.find((item) => item.id === edgeId);
    if (!edge) return "";
    const otherId = edge.from === nodeId ? edge.to : edge.from;
    const other = trace?.nodes.find((node) => node.id === otherId);
    return other?.code ?? otherId;
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[1800px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="mono-label text-rust">Module 12 / Batch DNA</p>
            <h1 className="mt-5 text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
              Trace the batch.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-obsidian/60">
              Follow finished goods backward to purchase evidence or forward to dispatch and invoice.
              Every node is a real record; every link carries its source quantity.
            </p>
          </div>
          <div className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
            <div className="grid grid-cols-2 gap-px bg-obsidian/10">
              <div className="bg-paper p-4">
                <p className="mono-label text-machine">Source lots</p>
                <p className="mt-2 text-3xl font-semibold tabular">{trace?.summary.sourceLots ?? 0}</p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-machine">Ledger events</p>
                <p className="mt-2 text-3xl font-semibold tabular">{trace?.summary.ledgerEvents ?? 0}</p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-machine">Good packets</p>
                <p className="mt-2 text-3xl font-semibold tabular">
                  {formatNumber(trace?.summary.goodOutputPackets ?? 0)}
                </p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-machine">Variance flags</p>
                <p className="mt-2 text-3xl font-semibold tabular text-rust">
                  {trace?.summary.varianceFlags ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="machine">{stages.length} controlled stages</Badge>
              <Badge variant="dark">{trace?.edges.length ?? 0} evidence links</Badge>
              {trace && trace.gaps.length > 0 ? <Badge variant="rust">{trace.gaps.length} gaps</Badge> : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-8 border border-rust/40 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</div>
        ) : null}

        <section className="mt-12 grid gap-6 xl:grid-cols-12">
          <aside className="xl:col-span-3">
            <div className="border border-obsidian/15">
              <div className="border-b border-obsidian/15 p-4">
                <p className="mono-label text-machine">Traceable batches</p>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-machine" aria-hidden="true" />
                  <Input
                    aria-label="Search traceable batches"
                    className={`${fieldClass()} pl-9`}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Batch or run"
                  />
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {filteredBatches.length === 0 ? (
                  <p className="p-4 text-xs leading-6 text-machine">
                    No posted batch traces yet. Post a production run to create one.
                  </p>
                ) : (
                  filteredBatches.map((batch) => {
                    const active = batch.batchCode === trace?.batchCode;
                    return (
                      <button
                        key={batch.batchCode}
                        type="button"
                        onClick={() => void loadTrace(batch.batchCode)}
                        className={`w-full border-b border-obsidian/10 px-4 py-4 text-left transition-colors ${
                          active ? "bg-obsidian text-paper" : "hover:bg-sage/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{batch.batchCode}</span>
                          <Badge variant={active ? "machine" : statusVariant(batch.status)}>
                            {batch.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className={`mt-2 text-sm ${active ? "text-paper/75" : "text-obsidian/70"}`}>
                          {batch.productName}
                        </p>
                        <div className={`mt-2 flex gap-3 mono-label ${active ? "text-paper/40" : "text-machine"}`}>
                          <span>{batch.runNumber}</span>
                          <span>{batch.sourceLots} lots</span>
                          {batch.flaggedLinks > 0 ? <span className="text-rust">{batch.flaggedLinks} flags</span> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <div className="xl:col-span-9">
            {!trace ? (
              <div className="surface-dark flex min-h-[560px] flex-col items-center justify-center p-10 text-center text-paper">
                <Route className="h-10 w-10 text-signal" aria-hidden="true" />
                <h2 className="mt-6 text-2xl font-semibold">Select a batch to begin</h2>
                <p className="mt-3 max-w-sm text-sm text-paper/55">
                  The trace graph loads only from posted production records and their linked evidence.
                </p>
              </div>
            ) : (
              <div className="surface-dark overflow-hidden" aria-busy={loading ? "true" : undefined}>
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-paper/10 p-5">
                  <div>
                    <p className="mono-label text-paper/40">Live trace</p>
                    <h2 className="mt-2 font-mono text-xl">{trace.batchCode}</h2>
                    <p className="mt-1 text-xs text-paper/50">
                      {trace.productCode} · {trace.runNumber} · {trace.productionDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={direction === "upstream" ? "default" : "outline"}
                      onClick={() => setDirection(direction === "upstream" ? "full" : "upstream")}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Upstream
                    </Button>
                    <Button
                      size="sm"
                      variant={direction === "downstream" ? "default" : "outline"}
                      onClick={() => setDirection(direction === "downstream" ? "full" : "downstream")}
                    >
                      Downstream
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void refreshBatches()}>
                      Refresh index
                    </Button>
                  </div>
                </div>

                <div className="flex gap-px overflow-x-auto border-b border-paper/10 bg-paper/10">
                  {stages.map((stage) => {
                    const count = trace.nodes.filter(
                      (node) => node.stage === stage.key && visibility.nodes.has(node.id),
                    ).length;
                    return (
                      <div key={stage.key} className="min-w-[112px] bg-obsidian px-3 py-3">
                        <p className="mono-label text-paper/35">{stage.short}</p>
                        <p className="mt-1 text-xs tabular text-paper/65">{count} nodes</p>
                      </div>
                    );
                  })}
                </div>

                <div className="max-h-[720px] overflow-auto p-5">
                  <div className="grid min-w-[1280px] grid-cols-10 gap-3">
                    {stages.map((stage) => {
                      const nodes = trace.nodes.filter(
                        (node) => node.stage === stage.key && visibility.nodes.has(node.id),
                      );
                      return (
                        <div key={stage.key} className="space-y-3">
                          <p className="mono-label sticky top-0 z-10 bg-obsidian py-1 text-paper/40">
                            {stage.label}
                          </p>
                          {nodes.length === 0 ? (
                            <p className="border border-dashed border-paper/10 p-3 text-[10px] leading-5 text-paper/25">
                              No evidence in this stage
                            </p>
                          ) : (
                            nodes.map((node) => {
                              const selected = node.id === selectedId;
                              const inboundLinks = inbound(node.id);
                              const outboundLinks = outbound(node.id);
                              return (
                                <button
                                  key={node.id}
                                  type="button"
                                  onClick={() => setSelectedId(node.id)}
                                  className={`w-full border p-3 text-left transition-colors ${
                                    selected
                                      ? "border-signal bg-signal/10"
                                      : node.risk
                                        ? "border-rust/40 bg-rust/5 hover:border-rust"
                                        : "border-paper/15 hover:border-paper/40"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-paper/55">
                                      {nodeIcon(node.kind)}
                                      <span className="mono-label">{node.kind}</span>
                                    </span>
                                    {node.risk ? (
                                      <AlertTriangle className="h-3.5 w-3.5 text-rust" aria-hidden="true" />
                                    ) : null}
                                  </div>
                                  <p className="mt-3 text-xs font-semibold leading-5 text-paper">{node.label}</p>
                                  <p className="mt-1 break-all font-mono text-[10px] text-signal">{node.code}</p>
                                  <p className="mt-2 text-[10px] leading-5 text-paper/45">{node.summary}</p>
                                  {node.quantity ? (
                                    <p className="mt-2 text-[10px] tabular text-paper/70">{node.quantity}</p>
                                  ) : null}
                                  {inboundLinks.length > 0 ? (
                                    <p className="mt-2 border-t border-paper/10 pt-2 text-[9px] leading-4 text-paper/40">
                                      in: {inboundLinks.slice(0, 2).map((edge) => `${edgeLabel(node.id, edge.id)} · ${edge.quantity ?? edge.label}`).join(" / ")}
                                    </p>
                                  ) : null}
                                  {outboundLinks.length > 0 ? (
                                    <p className="mt-1 text-[9px] leading-4 text-paper/40">
                                      out: {outboundLinks.slice(0, 2).map((edge) => `${edgeLabel(node.id, edge.id)} · ${edge.quantity ?? edge.label}`).join(" / ")}
                                    </p>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {trace && selectedNode ? (
          <section className="mt-10 grid gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="border border-obsidian/15 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mono-label text-machine">{selectedNode.stageLabel}</p>
                    <h2 className="mt-3 text-2xl font-semibold">{selectedNode.label}</h2>
                    <p className="mt-1 font-mono text-xs text-rust">{selectedNode.code}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.risk ? <Badge variant="rust">Flagged</Badge> : <Badge variant="outline">Verified link</Badge>}
                    {selectedNode.timestamp ? <Badge variant="dark">{selectedNode.timestamp}</Badge> : null}
                  </div>
                </div>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-obsidian/65">{selectedNode.summary}</p>
                <div className="mt-6 grid gap-px bg-obsidian/10 sm:grid-cols-3">
                  {[
                    ["Quantity", selectedNode.quantity ?? "—"],
                    ["Timestamp", selectedNode.timestamp ?? "—"],
                    ["Document", selectedNode.document ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-paper p-4">
                      <p className="mono-label text-machine">{label}</p>
                      <p className="mt-2 break-all text-sm">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <p className="mono-label text-machine">Record evidence</p>
                  <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {selectedNode.details.map((detail) => (
                      <div key={`${detail.label}-${detail.value}`} className="flex justify-between gap-4 border-b border-obsidian/10 py-2 text-xs">
                        <span className="text-machine">{detail.label}</span>
                        <span className="text-right">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedNode.links.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {selectedNode.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="mono-label border border-forest/30 px-3 py-2 text-forest underline-offset-4 hover:bg-sage/30 hover:underline"
                      >
                        {link.label}
                        <ArrowRight className="ml-2 inline h-3 w-3" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="xl:col-span-4">
              <div className="surface-dark h-full p-6 text-paper">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-signal" aria-hidden="true" />
                  <p className="mono-label text-paper/50">Trace summary</p>
                </div>
                <div className="mt-6 space-y-3 text-sm">
                  {[
                    ["Suppliers", String(trace.summary.supplierSources)],
                    ["Purchase lots", String(trace.summary.sourceLots)],
                    ["Planned packets", formatNumber(trace.summary.plannedOutputPackets)],
                    ["Good packets", formatNumber(trace.summary.goodOutputPackets)],
                    ["Damaged packets", formatNumber(trace.summary.damagedOutputPackets)],
                    ["Current stock packets", formatNumber(trace.summary.currentFinishedPackets)],
                    ["Dispatched packets", formatNumber(trace.summary.dispatchedPackets)],
                    ["Yield variance", `${trace.summary.yieldVarianceBasisPoints ?? 0} bps`],
                    ["Material cost", formatPaise(trace.summary.materialCostPaise ?? 0)],
                    ["Total cost", formatPaise(trace.summary.totalCostPaise ?? 0)],
                    ["Cost / packet", formatPaise(trace.summary.costPerPacketPaise ?? 0)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-paper/10 pb-2">
                      <span className="text-paper/50">{label}</span>
                      <span className="text-right tabular">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <p className="mono-label text-paper/40">Customers</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trace.summary.customers.length === 0 ? (
                      <span className="text-xs text-paper/45">No dispatch evidence yet</span>
                    ) : (
                      trace.summary.customers.map((customer) => (
                        <Badge key={customer} variant="machine">{customer}</Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-6">
                  <p className="mono-label text-paper/40">Provenance gaps</p>
                  {trace.gaps.length === 0 ? (
                    <p className="mt-3 text-xs text-paper/50">No missing source evidence detected.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {trace.gaps.map((gap) => (
                        <li key={gap} className="flex gap-2 text-xs leading-5 text-rust">
                          <CircleDot className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {activeRunNode ? (
                  <Link
                    href={activeRunNode.links[0]?.href ?? "/production"}
                    className="mono-label mt-6 inline-flex items-center gap-2 text-signal underline-offset-4 hover:underline"
                  >
                    Open production record
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
