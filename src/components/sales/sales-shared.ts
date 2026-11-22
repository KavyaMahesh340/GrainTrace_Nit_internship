import type { BadgeProps } from "@/components/ui/badge";

export type { BadgeProps };

export async function salesApiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as { ok?: boolean; error?: string } & T;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "The request could not be completed.");
  }
  return data;
}

export function salesStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "fulfilled" || status === "paid" || status === "delivered" || status === "active") return "default";
  if (status === "approved" || status === "issued" || status === "in_transit") return "dark";
  if (status === "partially_fulfilled" || status === "partially_paid" || status === "submitted") return "machine";
  if (status === "cancelled" || status === "rejected" || status === "overdue" || status === "blocked") return "rust";
  return "outline";
}

export function salesFieldClass() {
  return "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";
}

export function salesLabelClass() {
  return "mono-label mb-2 block text-machine";
}

export function parseAmount(value: string) {
  return Math.round(Number(value) * 100);
}

export function formatAmountInput(paise: number) {
  return (paise / 100).toFixed(2);
}
