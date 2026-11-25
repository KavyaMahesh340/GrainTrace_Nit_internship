"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  Play,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { MotionTabs } from "@/components/system/motion-tabs";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricGrid } from "@/components/ui/metric";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
import { formatPaise } from "@/domain";
import type {
  ProductionOptions,
  ProductionOverview,
  ProductionRunDetail,
  ProductionRunSummary,
} from "@/lib/workflows/production";

type Props = {
  initialRuns: ProductionRunSummary[];
  initialOverview: ProductionOverview;
  options: ProductionOptions;
  canManage: boolean;
  focus?: string;
};

type View = "runs" | "analytics";

const viewItems: readonly { value: View; label: string; hint?: string }[] = [
  { value: "runs", label: "Run register", hint: "Feed + output" },
  { value: "analytics", label: "Throughput", hint: "Yield + exceptions" },
];

const today = new Date().toISOString().slice(0, 10);

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as { ok?: boolean; error?: string } & T;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "The request could not be completed.");
  }
  return data;
}

function statusVariant(status: string) {
  if (status === "posted" || status === "completed") return "default";
  if (status === "in_progress") return "machine";
  if (status === "planned") return "dark";
  if (status === "draft") return "outline";
  return "rust";
}

function fieldClass() {
  return "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";
}

function labelClass() {
  return "mono-label mb-2 block text-ink-muted";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function ProductionWorkspace({ initialRuns, initialOverview, options, canManage, focus }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("runs");
  const [runs, setRuns] = useState(initialRuns);
  const [overview, setOverview] = useState(initialOverview);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<ProductionRunDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [completionDrafts, setCompletionDrafts] = useState<Record<string, { actual: string; damaged: string }>>({});
  const [completion, setCompletion] = useState({
    goodOutputPackets: "",
    damagedOutputPackets: "0",
    labourPaise: "0",
    gasPaise: "0",
    notes: "",
  });
  const [posting, setPosting] = useState({
    finishedBatchCode: "",
    packedOn: today,
    expiresAt: "",
    notes: "",
  });
  const [createDraft, setCreateDraft] = useState({
    runNumber: "",
    recipeId: String(options.recipes[0]?.id ?? ""),
    plannedOutputPackets: "",
    sellingPricePaise: "",
    notes: "",
  });

  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return runs.filter((run) => {
      if (status !== "all" && run.status !== status) return false;
      if (!needle) return true;
      return [run.runNumber, run.productName, run.recipeCode, run.batchCode ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, runs, status]);

  async function refresh() {
    const [runData, overviewData] = await Promise.all([
      apiRequest<{ runs: ProductionRunSummary[] }>("/api/production/runs"),
      apiRequest<{ overview: ProductionOverview }>("/api/production/overview"),
    ]);
    setRuns(runData.runs);
    setOverview(overviewData.overview);
    router.refresh();
  }

  async function openDetail(runNumber: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ detail: ProductionRunDetail }>(
        `/api/production/runs/${encodeURIComponent(runNumber)}`,
      );
      setDetail(data.detail);
      setDetailOpen(true);
      setPlanDrafts(
        Object.fromEntries(
          data.detail.lines.map((line) => {
            const material = options.materials.find((item) => item.itemId === line.itemId);
            const fallback = material?.batches[0]?.id ?? "";
            return [line.itemId, String(line.batchId ?? fallback)];
          }),
        ),
      );
      setCompletionDrafts(
        Object.fromEntries(
          data.detail.lines.map((line) => [
            line.itemId,
            {
              actual: String(line.actualQuantity || line.plannedQuantity),
              damaged: String(line.damagedQuantity),
            },
          ]),
        ),
      );
      setCompletion({
        goodOutputPackets: String(data.detail.metrics?.goodOutputPackets || data.detail.plannedOutputPackets),
        damagedOutputPackets: String(data.detail.damagedOutputPackets),
        labourPaise: String(data.detail.labourPaise),
        gasPaise: String(data.detail.gasPaise),
        notes: data.detail.notes,
      });
      setPosting((current) => ({
        ...current,
        finishedBatchCode: data.detail.batchCode ?? `FG-${data.detail.runNumber}`,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The run could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!focus || !runs.some((run) => run.runNumber === focus)) return;
    void openDetail(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, runs]);

  async function runAction(url: string, body: unknown, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(message);
      await refresh();
      const runNumber = detail?.runNumber;
      if (runNumber) await openDetail(runNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function createRun() {
    await runAction(
      "/api/production/runs",
      {
        runNumber: createDraft.runNumber,
        recipeId: Number(createDraft.recipeId),
        plannedOutputPackets: Number(createDraft.plannedOutputPackets),
        sellingPricePaise: createDraft.sellingPricePaise ? Number(createDraft.sellingPricePaise) : undefined,
        notes: createDraft.notes,
      },
      "Production run created as a draft.",
    );
    if (!error) {
      setCreateOpen(false);
      setCreateDraft({
        runNumber: "",
        recipeId: String(options.recipes[0]?.id ?? ""),
        plannedOutputPackets: "",
        sellingPricePaise: "",
        notes: "",
      });
      await openDetail(createDraft.runNumber);
    }
  }

  async function planRun() {
    if (!detail) return;
    await runAction(
      `/api/production/runs/${encodeURIComponent(detail.runNumber)}/plan`,
      {
        lines: detail.lines
          .filter((line) => planDrafts[line.itemId])
          .map((line) => ({ itemId: line.itemId, batchId: Number(planDrafts[line.itemId]) })),
      },
      "Source batches assigned; run is planned.",
    );
  }

  async function startRun() {
    if (!detail) return;
    await runAction(
      `/api/production/runs/${encodeURIComponent(detail.runNumber)}/status`,
      { status: "in_progress" },
      "Production started.",
    );
  }

  async function completeRun() {
    if (!detail) return;
    await runAction(
      `/api/production/runs/${encodeURIComponent(detail.runNumber)}/complete`,
      {
        lines: detail.lines.map((line) => ({
          itemId: line.itemId,
          actualQuantity: Number(completionDrafts[line.itemId]?.actual ?? 0),
          damagedQuantity: Number(completionDrafts[line.itemId]?.damaged ?? 0),
        })),
        goodOutputPackets: Number(completion.goodOutputPackets),
        damagedOutputPackets: Number(completion.damagedOutputPackets),
        labourPaise: Number(completion.labourPaise),
        gasPaise: Number(completion.gasPaise),
        notes: completion.notes,
      },
      "Actual consumption and output recorded.",
    );
  }

  async function postRun() {
    if (!detail) return;
    await runAction(
      `/api/production/runs/${encodeURIComponent(detail.runNumber)}/post`,
      {
        finishedBatchCode: posting.finishedBatchCode,
        packedOn: posting.packedOn,
        expiresAt: posting.expiresAt || undefined,
        notes: posting.notes,
      },
      "Production posted; ledger and cost snapshot are sealed.",
    );
  }

  const attention = runs.filter((run) => run.exceptionCount > 0);

  return (
    <div>
      <PageHeader
        code="06 / Production"
        title="Production runs"
        description="Plan against the live BOM, consume real batches, record yield and exceptions, then post an atomic ledger and cost snapshot. Posted runs are sealed."
        footnote="Plan · consume · record · post"
        tone="instrument"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-paper/15 bg-paper/15">
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">In progress</p>
                <p className="mt-2 text-3xl font-semibold tabular text-paper">{overview.inProgress}</p>
              </div>
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">Posted</p>
                <p className="mt-2 text-3xl font-semibold tabular text-paper">{overview.posted}</p>
              </div>
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">Good packets</p>
                <p className="mt-2 text-3xl font-semibold tabular text-paper">{formatNumber(overview.postedPackets)}</p>
              </div>
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">Exceptions</p>
                <p className="mt-2 text-3xl font-semibold tabular text-rust-ink">{overview.exceptions}</p>
              </div>
            </div>
            {canManage ? (
              <Button className="mt-5 w-full" onClick={() => setCreateOpen((open) => !open)}>
                {createOpen ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {createOpen ? "Close draft form" : "New production run"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">

        {createOpen && canManage ? (
          <section className="mt-10 border border-obsidian/20 bg-sage/20" aria-labelledby="production-create">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian/15 px-5 py-5 sm:px-7">
              <div className="min-w-0">
                <p className="mono-label text-rust-ink">01 / Create draft</p>
                <h2 id="production-create" className="mt-2 text-xl font-semibold">Select product recipe and planned output</h2>
              </div>
              <Button disabled={busy} onClick={() => void createRun()}>
                <Check className="h-4 w-4" aria-hidden="true" />
                Create draft
              </Button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5 sm:p-7">
              <label className="min-w-0">
                <span className={labelClass()}>Run number</span>
                <Input
                  className={fieldClass()}
                  value={createDraft.runNumber}
                  onChange={(event) => setCreateDraft({ ...createDraft, runNumber: event.target.value })}
                  placeholder="RUN-1001"
                />
              </label>
              <label className="min-w-0 sm:col-span-2">
                <span className={labelClass()}>Active recipe</span>
                <select
                  className={fieldClass()}
                  value={createDraft.recipeId}
                  onChange={(event) => setCreateDraft({ ...createDraft, recipeId: event.target.value })}
                >
                  {options.recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.code} v{recipe.version} · {formatNumber(recipe.expectedOutputPackets)} packets
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={labelClass()}>Planned packets</span>
                <Input
                  className={fieldClass()}
                  type="number"
                  min={1}
                  value={createDraft.plannedOutputPackets}
                  onChange={(event) =>
                    setCreateDraft({ ...createDraft, plannedOutputPackets: event.target.value })
                  }
                />
              </label>
              <label className="min-w-0">
                <span className={labelClass()}>Selling price / packet (paise)</span>
                <Input
                  className={fieldClass()}
                  type="number"
                  min={0}
                  value={createDraft.sellingPricePaise}
                  onChange={(event) => setCreateDraft({ ...createDraft, sellingPricePaise: event.target.value })}
                />
              </label>
              <label className="min-w-0 sm:col-span-2 xl:col-span-5">
                <span className={labelClass()}>Notes</span>
                <Input
                  className={fieldClass()}
                  value={createDraft.notes}
                  onChange={(event) => setCreateDraft({ ...createDraft, notes: event.target.value })}
                />
              </label>
            </div>
          </section>
        ) : null}

        {error ? <Notice tone="error" className="mt-8">{error}</Notice> : null}
        {notice ? <Notice tone="success" className="mt-8">{notice}</Notice> : null}

        <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
          <MotionTabs label="Production views" value={view} onChange={setView} items={viewItems} />
          <div className="flex w-full flex-col gap-3 border border-obsidian/15 bg-paper p-2 sm:w-auto sm:flex-row">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-ink-muted" aria-hidden="true" />
              <Input
                aria-label="Search production runs"
                className={`${fieldClass()} pl-9`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Run, product, batch"
              />
            </div>
            <select
              aria-label="Filter by status"
              className={`${fieldClass()} sm:w-44`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="posted">Posted</option>
            </select>
          </div>
        </div>

        {view === "runs" ? (
          <TableFrame
            className="mt-6"
            title="Run register"
            description="Planned output, yield variance, and sealed cost per packet"
            actions={<span className="mono-caption text-ink-muted">{filteredRuns.length} runs in view</span>}
          >
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="mono-label text-ink-muted">
                <tr className="border-b border-obsidian/15">
                  <th scope="col" className="py-3 pr-4 font-medium">Run</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Product / recipe</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Output</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Yield</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Cost / packet</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Status</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-ink-muted">
                      No production runs match this view.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => {
                    const progress =
                      run.plannedOutputPackets === 0
                        ? 0
                        : Math.min(100, Math.round((run.actualOutputPackets / run.plannedOutputPackets) * 100));
                    return (
                      <tr key={run.id} className="data-row align-top">
                        <td className="py-4 pr-4">
                          <p className="font-mono text-xs font-semibold">{run.runNumber}</p>
                          <p className="mt-1 text-xs text-ink-muted">{run.batchCode ?? "No batch yet"}</p>
                        </td>
                        <td className="py-4 pr-4">
                          <p>{run.productName}</p>
                          <p className="mt-1 font-mono text-xs text-ink-muted">
                            {run.recipeCode} v{run.recipeVersion}
                          </p>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-end gap-2 tabular">
                            <span className="text-lg font-semibold">{formatNumber(run.goodOutputPackets)}</span>
                            <span className="text-xs text-ink-muted">/ {formatNumber(run.plannedOutputPackets)}</span>
                          </div>
                          <div
                            className="meter-track mt-2 w-32"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                            aria-label={`${run.runNumber} output progress`}
                          >
                            <div className="h-full bg-forest" style={{ width: `${progress}%` }} />
                          </div>
                        </td>
                        <td className="py-4 pr-4 tabular">
                          <p>{run.yieldVarianceBasisPoints ?? 0} bps</p>
                          {run.exceptionCount > 0 ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-rust-ink">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {run.exceptionCount} exceptions
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-ink-muted">Within tolerance</p>
                          )}
                        </td>
                        <td className="py-4 pr-4 tabular">
                          {run.costPerPacketPaise === null ? "—" : formatPaise(run.costPerPacketPaise)}
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant={statusVariant(run.status)}>{run.status.replace("_", " ")}</Badge>
                        </td>
                        <td className="py-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => void openDetail(run.runNumber)}>
                            Inspect
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableFrame>
        ) : (
          <section className="mt-10 grid gap-8 lg:grid-cols-12" aria-label="Production analytics">
            <div className="min-w-0 lg:col-span-7">
              <div className="border border-obsidian/15 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rust-ink" aria-hidden="true" />
                  <p className="mono-label text-ink-muted">02 / Planned vs actual output</p>
                </div>
                <div className="mt-6 space-y-5">
                  {filteredRuns.slice(0, 8).map((run) => {
                    const actualPercent =
                      run.plannedOutputPackets === 0
                        ? 0
                        : Math.min(100, Math.round((run.actualOutputPackets / run.plannedOutputPackets) * 100));
                    const goodPercent =
                      run.plannedOutputPackets === 0
                        ? 0
                        : Math.min(100, Math.round((run.goodOutputPackets / run.plannedOutputPackets) * 100));
                    return (
                      <div key={run.id}>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="font-mono">{run.runNumber}</span>
                          <span className="tabular text-ink-muted">
                            {formatNumber(run.actualOutputPackets)} actual · {formatNumber(run.goodOutputPackets)} good
                          </span>
                        </div>
                        <div className="meter-track mt-2 h-2">
                          <div className="h-full bg-machine" style={{ width: `${actualPercent}%` }} />
                        </div>
                        <div className="meter-track mt-1 h-2">
                          <div className="h-full bg-forest" style={{ width: `${goodPercent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex gap-5 mono-label text-ink-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-4 bg-machine" /> Actual
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-4 bg-forest" /> Good
                  </span>
                </div>
              </div>
            </div>
            <div className="min-w-0 lg:col-span-5">
              <div className="surface-dark p-5 text-paper sm:p-6">
                <p className="mono-label text-paper-muted">03 / Exception watch</p>
                <h2 className="mt-3 text-2xl font-semibold text-balance">{overview.exceptions} runs need review</h2>
                <div className="mt-6 space-y-3">
                  {attention.length === 0 ? (
                    <p className="text-sm text-paper-muted">No material or yield variance exceeds 3%.</p>
                  ) : (
                    attention.slice(0, 6).map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => void openDetail(run.runNumber)}
                        className="flex w-full min-w-0 items-center justify-between gap-4 border border-paper/15 px-4 py-3 text-left transition-colors hover:border-signal"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-xs">{run.runNumber}</span>
                          <span className="mt-1 block text-xs text-paper-muted">
                            {run.yieldVarianceBasisPoints ?? 0} bps yield
                          </span>
                        </span>
                        <span className="mono-label shrink-0 text-rust-ink">{run.exceptionCount} flags</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          {loading || !detail ? (
            <div className="p-6 text-sm text-paper-muted">Loading run evidence…</div>
          ) : (
            <>
              <SheetHeader className="border-b border-paper/10">
                <SheetDescription>Production run</SheetDescription>
                <SheetTitle className="text-2xl">{detail.runNumber}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge variant={statusVariant(detail.status)}>{detail.status.replace("_", " ")}</Badge>
                  {detail.exceptionCount > 0 ? <Badge variant="rust">Exceptions</Badge> : null}
                  {detail.batchCode ? (
                    <Link
                      href={`/batch-dna?batch=${encodeURIComponent(detail.batchCode)}`}
                      className="mono-label text-signal underline-offset-4 hover:underline"
                    >
                      Trace batch
                    </Link>
                  ) : null}
                </div>
              </SheetHeader>

              <div className="space-y-8 p-6">
                <MetricGrid
                  className="border border-paper/10"
                  columns={4}
                  items={[
                    { label: "Planned", value: `${formatNumber(detail.plannedOutputPackets)} pkts`, tone: "dark" },
                    { label: "Good", value: `${formatNumber(detail.goodOutputPackets)} pkts`, tone: "dark" },
                    { label: "Damaged", value: `${formatNumber(detail.damagedOutputPackets)} pkts`, tone: "dark" },
                    { label: "Yield", value: `${detail.yieldVarianceBasisPoints ?? 0} bps`, tone: "dark" },
                  ]}
                />

                <section>
                  <p className="mono-label text-paper-muted">01 / Material plan and actual consumption</p>
                  <div className="mt-4 space-y-3">
                    {detail.lines.map((line) => (
                      <div key={line.itemId} className="border border-paper/15 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-paper">{line.materialName}</p>
                            <p className="mt-1 font-mono text-[10px] text-paper-muted">
                              {line.materialCode} · {line.batchCode ?? "batch not assigned"}
                            </p>
                          </div>
                          <Badge variant={line.flagged ? "rust" : "outline"}>
                            {line.varianceBasisPoints ?? 0} bps
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-xs tabular text-paper-muted">
                          <p>Planned {formatNumber(line.plannedQuantity)}</p>
                          <p>Actual {formatNumber(line.actualQuantity + line.damagedQuantity)}</p>
                          <p>Damaged {formatNumber(line.damagedQuantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {detail.snapshot ? (
                  <section className="border border-paper/15 p-5">
                    <p className="mono-label text-paper-muted">02 / Sealed cost snapshot</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      {[
                        ["Material", detail.snapshot.materialCostPaise],
                        ["Labour", detail.snapshot.labourPaise],
                        ["Overhead", detail.snapshot.overheadPaise],
                        ["Total", detail.snapshot.totalRunCostPaise],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="min-w-0">
                          <p className="text-paper-muted">{label}</p>
                          <p className="mt-1 font-medium tabular">{formatPaise(Number(value))}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 border-t border-paper/10 pt-4 text-sm">
                      Cost per good packet:{" "}
                      <span className="font-semibold text-signal">
                        {formatPaise(detail.snapshot.costPerGoodPacketPaise)}
                      </span>
                    </p>
                  </section>
                ) : null}

                {canManage && detail.status === "draft" ? (
                  <section className="border border-paper/15 p-5">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-signal" aria-hidden="true" />
                      <p className="mono-label text-paper-muted">03 / Plan source batches</p>
                    </div>
                    <div className="mt-5 space-y-3">
                      {detail.lines.map((line) => {
                        const material = options.materials.find((item) => item.itemId === line.itemId);
                        return (
                          <label key={line.itemId} className="block min-w-0">
                            <span className="mono-label mb-2 block text-paper-muted">
                              {line.materialCode} · needs {formatNumber(line.plannedQuantity)}
                            </span>
                            <select
                              className="h-11 w-full rounded-sm border border-paper/20 bg-obsidian px-3 text-sm text-paper"
                              value={planDrafts[line.itemId] ?? ""}
                              onChange={(event) =>
                                setPlanDrafts({ ...planDrafts, [line.itemId]: event.target.value })
                              }
                            >
                              {material?.batches.length ? (
                                material.batches.map((batch) => (
                                  <option key={batch.id} value={batch.id}>
                                    {batch.batchCode} · {formatNumber(batch.availableQuantity)} available
                                  </option>
                                ))
                              ) : (
                                <option value="">No stocked batch available</option>
                              )}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                    <Button className="mt-5" disabled={busy} onClick={() => void planRun()}>
                      Assign batches and plan
                    </Button>
                  </section>
                ) : null}

                {canManage && detail.status === "planned" ? (
                  <Button disabled={busy} onClick={() => void startRun()}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Start production
                  </Button>
                ) : null}

                {canManage && detail.status === "in_progress" ? (
                  <section className="border border-paper/15 p-5">
                    <p className="mono-label text-paper-muted">03 / Record actual consumption and output</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {detail.lines.map((line) => (
                        <div key={line.itemId} className="min-w-0 border border-paper/10 p-3">
                          <p className="text-xs font-medium">{line.materialName}</p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Input
                              aria-label={`${line.materialCode} actual quantity`}
                              className="h-10 border-paper/20 bg-obsidian text-xs text-paper"
                              type="number"
                              min={1}
                              value={completionDrafts[line.itemId]?.actual ?? ""}
                              onChange={(event) =>
                                setCompletionDrafts({
                                  ...completionDrafts,
                                  [line.itemId]: {
                                    actual: event.target.value,
                                    damaged: completionDrafts[line.itemId]?.damaged ?? "0",
                                  },
                                })
                              }
                            />
                            <Input
                              aria-label={`${line.materialCode} damaged quantity`}
                              className="h-10 border-paper/20 bg-obsidian text-xs text-paper"
                              type="number"
                              min={0}
                              value={completionDrafts[line.itemId]?.damaged ?? "0"}
                              onChange={(event) =>
                                setCompletionDrafts({
                                  ...completionDrafts,
                                  [line.itemId]: {
                                    actual: completionDrafts[line.itemId]?.actual ?? "0",
                                    damaged: event.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Input
                        aria-label="Good output packets"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        type="number"
                        min={1}
                        value={completion.goodOutputPackets}
                        onChange={(event) => setCompletion({ ...completion, goodOutputPackets: event.target.value })}
                      />
                      <Input
                        aria-label="Damaged output packets"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        type="number"
                        min={0}
                        value={completion.damagedOutputPackets}
                        onChange={(event) =>
                          setCompletion({ ...completion, damagedOutputPackets: event.target.value })
                        }
                      />
                      <Input
                        aria-label="Labour paise"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        type="number"
                        min={0}
                        value={completion.labourPaise}
                        onChange={(event) => setCompletion({ ...completion, labourPaise: event.target.value })}
                      />
                      <Input
                        aria-label="Gas and overhead paise"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        type="number"
                        min={0}
                        value={completion.gasPaise}
                        onChange={(event) => setCompletion({ ...completion, gasPaise: event.target.value })}
                      />
                    </div>
                    <Button className="mt-5" disabled={busy} onClick={() => void completeRun()}>
                      Complete run
                    </Button>
                  </section>
                ) : null}

                {canManage && detail.status === "completed" ? (
                  <section className="border border-signal/30 p-5">
                    <p className="mono-label text-signal">04 / Post production</p>
                    <p className="mt-3 text-sm text-paper-muted">
                      Posting atomically deducts materials, writes damaged output separately, adds finished
                      goods, and seals the cost snapshot.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Input
                        aria-label="Finished batch code"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        value={posting.finishedBatchCode}
                        onChange={(event) => setPosting({ ...posting, finishedBatchCode: event.target.value })}
                      />
                      <Input
                        aria-label="Packed on"
                        className="h-11 border-paper/20 bg-obsidian text-sm text-paper"
                        type="date"
                        value={posting.packedOn}
                        onChange={(event) => setPosting({ ...posting, packedOn: event.target.value })}
                      />
                    </div>
                    <Button className="mt-5" disabled={busy} onClick={() => void postRun()}>
                      Post production
                    </Button>
                  </section>
                ) : null}

                {detail.status === "posted" ? (
                  <p className="border border-paper/15 p-4 text-sm text-paper-muted">
                    This run is posted and cannot be edited. Corrections must use inventory adjustments.
                  </p>
                ) : null}

                <section>
                  <p className="mono-label text-paper-muted">05 / Audit trail</p>
                  <div className="mt-4 space-y-2">
                    {detail.audit.map((event) => (
                      <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-2 text-xs">
                        <span className="min-w-0 font-mono">{event.action}</span>
                        <span className="shrink-0 text-paper-muted">{event.createdAt}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
