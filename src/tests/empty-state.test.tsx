import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders an honest empty state with a working action link", () => {
    render(
      <EmptyState
        code="Planned for phase 2"
        title="This workflow is scoped, not simulated."
        description="Phase 1 establishes the foundation and route structure."
        actionLabel="Back to factory overview"
        actionHref="/"
      />,
    );

    expect(screen.getByText(/planned for phase 2/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to factory overview/i })).toHaveAttribute("href", "/");
  });
});
