"use client";

import { useState } from "react";
import { ArrowUpRight, RefreshCw, Search, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

function queryFor(filters: Filters) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value) params.set(name, value);
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
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">ACCOUNTABILITY / 11</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Audit & auditor trail.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Search the immutable event log, inspect before and after values, and follow any invoice or batch from
              source to final transaction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="dark">{entries.length} events</Badge>
            <Badge variant="dark">Role-aware entries</Badge>
          </div>
        </div>
      </header>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}

        <section className="border border-obsidian/15 bg-paper p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-64 flex-1">
              <span className="mono-label text-machine">SEARCH</span>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-machine" />
                <Input
                  value={filters.query}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                  placeholder="Action, entity, actor, metadata"
                  className="pl-9"
                />
              </div>
            </label>
            <label>
              <span className="mono-label text-machine">ACTION</span>
              <Input
                value={filters.action}
                onChange={(event) => setFilters({ ...filters, action: event.target.value })}
                placeholder="PAYMENT_"
                className="mt-1"
              />
            </label>
            <label>
              <span className="mono-label text-machine">ENTITY</span>
              <Input
                value={filters.entityType}
                onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}
                placeholder="invoice"
                className="mt-1"
              />
            </label>
            <label>
              <span className="mono-label text-machine">FROM</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                className="mt-1"
              />
            </label>
            <label>
              <span className="mono-label text-machine">TO</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                className="mt-1"
              />
            </label>
            <Button onClick={() => void loadEntries()} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Search
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="mono-label text-machine">EVENT LOG</p>
            <h2 className="mt-1 text-2xl font-semibold">Chronological entries</h2>
          </div>
          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">When</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Actor</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Action</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Entity</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Severity</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Reason</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                    <td className="px-4 py-3 font-mono text-xs text-machine">{entry.createdAt}</td>
                    <td className="px-4 py-3">
                      <p>{entry.actorName ?? entry.actorEmail ?? "System"}</p>
                      <p className="font-mono text-[10px] uppercase text-machine">{entry.actorRole ?? "system"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.action.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-xs">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={entry.severity === "info" ? "default" : "rust"}>{entry.severity}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-machine">{entry.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(entry)}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-machine">
                      No audit entries match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-obsidian/15 bg-paper p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-80 flex-1">
              <span className="mono-label text-machine">AUDITOR TRAIL</span>
              <Input
                value={trailIdentifier}
                onChange={(event) => setTrailIdentifier(event.target.value)}
                placeholder="Invoice number, batch code, or run number"
                className="mt-1"
              />
            </label>
            <Button onClick={() => void loadTrail()} disabled={busy || !trailIdentifier.trim()}>
              <Workflow className="h-4 w-4" /> Follow trail
            </Button>
          </div>
          {trail ? (
            <div className="mt-6">
              <p className="mono-label text-machine">{trail.kind.toUpperCase()} · {trail.identifier}</p>
              <h3 className="mt-1 text-xl font-semibold">{trail.title}</h3>
              {trail.gaps.length > 0 ? (
                <p className="mt-2 border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">
                  {trail.gaps.join(" ")}
                </p>
              ) : null}
              <ol className="mt-5 space-y-0 border-l border-forest/40 pl-6">
                {trail.steps.map((step) => (
                  <li key={step.id} className="relative pb-6">
                    <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-paper bg-forest" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="mono-label text-machine">{step.stage}</p>
                      {step.timestamp ? (
                        <p className="font-mono text-[10px] text-machine">{step.timestamp}</p>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium">{step.label}</p>
                    <p className="mt-1 text-sm text-machine">{step.detail}</p>
                    {step.href ? (
                      <Button variant="ghost" size="sm" asChild className="mt-1 -ml-3">
                        <a href={step.href}>
                          Open source <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                  </li>
                ))}
                {trail.steps.length === 0 ? (
                  <li className="text-sm text-machine">No trail steps were found.</li>
                ) : null}
              </ol>
            </div>
          ) : (
            <p className="mt-5 text-sm text-machine">
              Enter an invoice, batch, or run reference to assemble a source-to-transaction trail.
            </p>
          )}
        </section>
      </main>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => (open ? null : setSelected(null))}>
        <SheetContent side="bottom" className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selected?.action.replaceAll("_", " ") ?? "Audit event"}</SheetTitle>
            <SheetDescription>
              {selected
                ? `${selected.entityType}${selected.entityId ? ` · ${selected.entityId}` : ""} · ${selected.createdAt}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-4 px-6 pb-8 text-sm">
              <div>
                <p className="mono-label text-machine">ACTOR</p>
                <p className="mt-1">{selected.actorName ?? selected.actorEmail ?? "System"}</p>
                <p className="font-mono text-[10px] uppercase text-machine">{selected.actorRole ?? "system"}</p>
              </div>
              {selected.reason ? (
                <div>
                  <p className="mono-label text-machine">REASON</p>
                  <p className="mt-1">{selected.reason}</p>
                </div>
              ) : null}
              <pre className="overflow-x-auto border border-obsidian/15 bg-pale-sage/40 p-3 font-mono text-xs">
                {JSON.stringify({ before: selected.before, after: selected.after, metadata: selected.metadata }, null, 2)}
              </pre>
              {selected.sourceHref ? (
                <Button variant="outline" asChild>
                  <a href={selected.sourceHref}>
                    Open source document <ArrowUpRight className="h-3 w-3" />
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
