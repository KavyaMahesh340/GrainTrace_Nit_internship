"use client";

import { useState } from "react";
import { ArrowUpRight, RefreshCw, Search, Workflow } from "lucide-react";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
import type { AuditEntry, AuditorTrail } from "@/lib/workflows/audit-explorer";

type Props = {
  initialEntries: AuditEntry[];
  initialTrail: AuditorTrail | null;
  focus?: string;
};

type Filters = {
  query: string;
  action: string;
  entityType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

const fieldClass =
  "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";

function queryFor(filters: Filters) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (!value) continue;
    if (name === "userId" && !/^\d+$/.test(value.trim())) {
      params.set("query", value.trim());
      continue;
    }
    params.set(name, value);
  }
  return params.toString();
}

export function AuditWorkspace({ initialEntries, initialTrail, focus }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [trail, setTrail] = useState(initialTrail);
  const [trailIdentifier, setTrailIdentifier] = useState(focus ?? "");
  const [filters, setFilters] = useState<Filters>({
    query: focus ?? "",
    action: "",
    entityType: "",
    userId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEntries() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/audit/entries?${queryFor(filters)}`, { cache: "no-store" });
      const data: { ok?: boolean; entries?: AuditEntry[]; error?: string } = await response.json();
      if (!response.ok || !data.entries) throw new Error(data.error ?? "The audit log could not be loaded.");
      setEntries(data.entries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The audit log could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTrail(identifier = trailIdentifier) {
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/audit/trail?identifier=${encodeURIComponent(identifier)}`, {
        cache: "no-store",
      });
      const data: { ok?: boolean; trail?: AuditorTrail; error?: string } = await response.json();
      if (!response.ok || !data.trail) throw new Error(data.error ?? "The trail could not be loaded.");
      setTrail(data.trail);
      setTrailIdentifier(identifier);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The trail could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        code="ACCOUNTABILITY / 11"
        title="Audit & auditor trail."
        description="Search the immutable event log, inspect before and after values, and follow any invoice or batch from source to final transaction."
        footnote="Search · inspect · follow"
        tone="instrument"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-paper/15 bg-paper/15">
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">Events</p>
                <p className="mt-2 font-mono text-2xl tabular text-paper">{entries.length}</p>
              </div>
              <div className="bg-forest p-4">
                <p className="mono-label text-paper-muted">Trail steps</p>
                <p className="mt-2 font-mono text-2xl tabular text-paper">{trail?.steps.length ?? 0}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="dark">Role-aware entries</Badge>
              <Badge variant="dark">Immutable log</Badge>
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
        {error ? <Notice tone="error" className="mb-8">{error}</Notice> : null}

        <section className="border border-obsidian/15 bg-paper" aria-labelledby="audit-query">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/15 px-5 py-4">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">01 / Query parameters</p>
              <h2 id="audit-query" className="mt-2 text-xl font-semibold tracking-tight">
                Search the event log
              </h2>
            </div>
            <span className="mono-caption text-ink-muted">Filters apply on search</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-6">
            <label className="min-w-0 sm:col-span-2 xl:col-span-2">
              <span className="mono-label mb-2 block text-ink-muted">SEARCH</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <Input
                  value={filters.query}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                  placeholder="Action, entity, actor, metadata"
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">ACTION</span>
              <Input
                value={filters.action}
                onChange={(event) => setFilters({ ...filters, action: event.target.value })}
                placeholder="PAYMENT_"
                className={fieldClass}
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">ENTITY</span>
              <Input
                value={filters.entityType}
                onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}
                placeholder="invoice"
                className={fieldClass}
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">ACTOR ID / EMAIL</span>
              <Input
                value={filters.userId}
                onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
                placeholder="User id or email"
                className={fieldClass}
                aria-describedby="audit-actor-hint"
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">FROM</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">TO</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                className={fieldClass}
              />
            </label>
            <p id="audit-actor-hint" className="mono-caption text-ink-muted sm:col-span-2 xl:col-span-4">
              Numeric user ids match exactly; an email searches logged actors.
            </p>
            <div className="flex min-w-0 items-end sm:col-span-2 xl:col-span-2 xl:justify-end">
              <Button onClick={() => void loadEntries()} disabled={busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Search
              </Button>
            </div>
          </div>
        </section>

        <TableFrame
          className="mt-10"
          title="Chronological entries"
          description="Immutable audit events, newest first"
          actions={<span className="mono-caption text-ink-muted">{entries.length} events</span>}
        >
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="mono-label text-ink-muted">
              <tr className="border-b border-obsidian/15">
                <th scope="col" className="py-3 pr-4 font-medium">When</th>
                <th scope="col" className="py-3 pr-4 font-medium">Actor</th>
                <th scope="col" className="py-3 pr-4 font-medium">Action</th>
                <th scope="col" className="py-3 pr-4 font-medium">Entity</th>
                <th scope="col" className="py-3 pr-4 font-medium">Severity</th>
                <th scope="col" className="py-3 pr-4 font-medium">Reason</th>
                <th scope="col" className="py-3 text-right font-medium">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="data-row align-top">
                  <td className="py-4 pr-4 font-mono text-xs tabular text-ink-muted">{entry.createdAt}</td>
                  <td className="min-w-0 py-4 pr-4">
                    <p className="font-medium">{entry.actorName ?? entry.actorEmail ?? "System"}</p>
                    <p className="mono-label mt-1 text-ink-muted">{entry.actorRole ?? "system"}</p>
                  </td>
                  <td className="py-4 pr-4 font-mono text-xs">{entry.action.replaceAll("_", " ")}</td>
                  <td className="py-4 pr-4 font-mono text-xs text-ink-muted">
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId}` : ""}
                  </td>
                  <td className="py-4 pr-4">
                    <Badge variant={entry.severity === "info" ? "default" : "rust"}>{entry.severity}</Badge>
                  </td>
                  <td className="py-4 pr-4 text-xs text-ink-muted">{entry.reason ?? "—"}</td>
                  <td className="py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(entry)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    No audit entries match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableFrame>

        <section className="mt-10 border border-obsidian/15 bg-paper" aria-labelledby="audit-trail">
          <div className="border-b border-obsidian/15 px-5 py-4">
            <p className="mono-label text-rust-ink">03 / Source to transaction</p>
            <h2 id="audit-trail" className="mt-2 text-xl font-semibold tracking-tight">
              Auditor trail
            </h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="min-w-0">
                <span className="mono-label mb-2 block text-ink-muted">AUDITOR TRAIL</span>
                <Input
                  value={trailIdentifier}
                  onChange={(event) => setTrailIdentifier(event.target.value)}
                  placeholder="Invoice number, batch code, or run number"
                  className={fieldClass}
                />
              </label>
              <Button onClick={() => void loadTrail()} disabled={busy || !trailIdentifier.trim()}>
                <Workflow className="h-4 w-4" aria-hidden="true" /> Follow trail
              </Button>
            </div>

            {trail ? (
              <div className="mt-8 border-t border-obsidian/15 pt-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mono-caption text-ink-muted">{trail.kind.toUpperCase()} · {trail.identifier}</p>
                    <h3 className="mt-2 text-xl font-semibold">{trail.title}</h3>
                  </div>
                  <span className="mono-caption text-ink-muted">{trail.steps.length} steps</span>
                </div>
                {trail.gaps.length > 0 ? (
                  <Notice tone="error" className="mt-4">
                    {trail.gaps.join(" ")}
                  </Notice>
                ) : null}
                <ol className="mt-6 space-y-0 border-l border-forest/40 pl-7">
                  {trail.steps.map((step) => (
                    <li key={step.id} className="relative pb-7 last:pb-0">
                      <span
                        className={`absolute -left-[34px] top-1.5 h-3 w-3 rounded-full border-2 border-paper ${
                          step.risk ? "bg-rust" : "bg-forest"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="mono-label text-ink-muted">{step.stage}</p>
                        {step.timestamp ? (
                          <p className="font-mono text-[11px] tabular text-ink-muted">{step.timestamp}</p>
                        ) : null}
                      </div>
                      <p className="mt-1 font-medium">{step.label}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">{step.detail}</p>
                      {step.href ? (
                        <Button variant="ghost" size="sm" asChild className="mt-2 -ml-3">
                          <a href={step.href}>
                            Open source <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                  {trail.steps.length === 0 ? (
                    <li className="text-sm text-ink-muted">No trail steps were found.</li>
                  ) : null}
                </ol>
              </div>
            ) : (
              <p className="mt-5 border-t border-obsidian/15 pt-5 text-sm text-ink-muted">
                Enter an invoice, batch, or run reference to assemble a source-to-transaction trail.
              </p>
            )}
          </div>
        </section>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => (open ? null : setSelected(null))}>
        <SheetContent side="bottom" className="max-w-2xl overflow-y-auto">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-signal">Audit event</p>
            <SheetTitle className="text-xl">{selected?.action.replaceAll("_", " ") ?? "Audit event"}</SheetTitle>
            <SheetDescription>
              {selected
                ? `${selected.entityType}${selected.entityId ? ` · ${selected.entityId}` : ""} · ${selected.createdAt}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-6 px-6 pb-8 text-sm">
              <div className="grid gap-px border border-paper/10 bg-paper/10 sm:grid-cols-3">
                <div className="min-w-0 bg-obsidian p-4">
                  <p className="mono-label text-paper-muted">ACTOR</p>
                  <p className="mt-2 break-words">{selected.actorName ?? selected.actorEmail ?? "System"}</p>
                  <p className="mono-label mt-1 text-paper-muted">{selected.actorRole ?? "system"}</p>
                </div>
                <div className="min-w-0 bg-obsidian p-4">
                  <p className="mono-label text-paper-muted">SEVERITY</p>
                  <p className="mt-2 font-mono text-sm">{selected.severity}</p>
                </div>
                <div className="min-w-0 bg-obsidian p-4">
                  <p className="mono-label text-paper-muted">WHEN</p>
                  <p className="mt-2 break-words font-mono text-xs">{selected.createdAt}</p>
                </div>
              </div>
              {selected.reason ? (
                <section>
                  <p className="mono-label text-paper-muted">REASON</p>
                  <p className="mt-2 leading-6">{selected.reason}</p>
                </section>
              ) : null}
              <section>
                <p className="mono-label text-paper-muted">CHANGE PAYLOAD</p>
                <pre
                  className="table-scroll mt-2 border border-paper/15 bg-obsidian p-3 font-mono text-xs text-paper-muted"
                  role="region"
                  aria-label="Audit event payload"
                  tabIndex={0}
                >
                  {JSON.stringify({ before: selected.before, after: selected.after, metadata: selected.metadata }, null, 2)}
                </pre>
              </section>
              {selected.sourceHref ? (
                <Button variant="light" asChild>
                  <a href={selected.sourceHref}>
                    Open source document <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
