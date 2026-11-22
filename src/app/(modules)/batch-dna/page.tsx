import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BatchDnaPanel } from "@/components/overview/batch-dna-panel";
import { PreviewBadge } from "@/components/system/preview-badge";
import { previewSnapshot } from "@/lib/data/preview";

export const metadata: Metadata = {
  title: "Batch DNA concept",
};

export default function BatchDnaPage() {
  const data = previewSnapshot;

  return (
    <>
      <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-machine underline-offset-4 hover:text-obsidian hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Factory overview
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <PreviewBadge />
              <span className="mono-label text-machine">Concept / Not implemented</span>
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-none tracking-tightest sm:text-7xl">
              Batch DNA
            </h1>
          </div>
          <div className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
            <p className="text-sm leading-7 text-obsidian/60">
              The signature visualization for GRAINTRACE. It will eventually trace a batch from raw
              material sources through production to finished goods and delivery.
            </p>
          </div>
        </div>
      </div>
      <BatchDnaPanel dna={data.dna} expanded />
      <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-8">
        <p className="mono-label text-machine">Planned capabilities</p>
        <div className="mt-5 grid gap-4 text-xs leading-6 text-obsidian/60 sm:grid-cols-3">
          <p>Raw material source lots linked to mixer and cook records.</p>
          <p>Production exceptions attached to the exact batch step.</p>
          <p>Finished goods, invoice, dispatch, and collection evidence in one trace.</p>
        </div>
      </div>
    </>
  );
}
