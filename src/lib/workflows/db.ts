import type { getDb } from "@/lib/db";

export type WorkflowDb = ReturnType<typeof getDb>;
export type WorkflowTransaction = Parameters<Parameters<WorkflowDb["transaction"]>[0]>[0];

export type StockTarget =
  | { type: "raw"; id: number }
  | { type: "packaging"; id: number }
  | { type: "finished_good"; id: number };

export function stockItemKey(target: StockTarget) {
  return `${target.type}:${target.id}`;
}
