import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("recipes:view");
  return (
    <ProtectedModulePage
      permission="recipes:view"
      code="05"
      title="Recipes"
      description="Recipes define input ratios and output expectations. Versioning, tolerance rules, and batch linkage are Phase 2 workflows."
      focusLabel="Recipe reference"
      focusValue={searchParams.focus}
    />
  );
}
