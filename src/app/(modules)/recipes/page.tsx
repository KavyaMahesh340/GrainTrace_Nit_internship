import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Recipes" };

export default function RecipesPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="05"
      title="Recipes"
      description="Recipes define input ratios and output expectations. Versioning, tolerance rules, and batch linkage are Phase 2 workflows."
      focusLabel="Recipe reference"
      focusValue={searchParams.focus}
    />
  );
}
