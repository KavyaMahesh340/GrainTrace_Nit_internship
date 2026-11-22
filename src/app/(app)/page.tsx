import type { Metadata } from "next";
import { ActivityLog } from "@/components/overview/activity-log";
import { ActionArea } from "@/components/overview/action-area";
import { BatchDnaPanel } from "@/components/overview/batch-dna-panel";
import { ExceptionsPanel } from "@/components/overview/exceptions-panel";
import { FactoryHeading } from "@/components/overview/factory-heading";
import { MaterialFlow } from "@/components/overview/material-flow";
import { OrdersQueue } from "@/components/overview/orders-queue";
import { ProductionPulse } from "@/components/overview/production-pulse";
import { StockRisk } from "@/components/overview/stock-risk";
import { Reveal } from "@/components/system/reveal";
import { requirePermission } from "@/lib/auth/access";
import { previewSnapshot } from "@/lib/data/preview";

export const metadata: Metadata = {
  title: "Factory overview",
};

export default async function FactoryOverviewPage() {
  requirePermission("overview:view");
  const data = previewSnapshot;

  return (
    <>
      <FactoryHeading factory={data.factory} generatedAt={data.generatedAt} />
      <Reveal>
        <ProductionPulse pulse={data.pulse} />
      </Reveal>
      <Reveal>
        <MaterialFlow flow={data.flow} />
      </Reveal>
      <Reveal>
        <OrdersQueue orders={data.orders} />
      </Reveal>
      <Reveal>
        <StockRisk stock={data.stock} />
      </Reveal>
      <Reveal>
        <ExceptionsPanel exceptions={data.exceptions} />
      </Reveal>
      <Reveal>
        <ActionArea focusId={data.orders[0].id} />
      </Reveal>
      <Reveal>
        <ActivityLog activity={data.activity} />
      </Reveal>
      <BatchDnaPanel dna={data.dna} />
    </>
  );
}
