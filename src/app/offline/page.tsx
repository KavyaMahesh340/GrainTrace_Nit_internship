import type { Metadata } from "next";
import { OfflinePageContent } from "@/components/system/offline-page-content";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return <OfflinePageContent />;
}
