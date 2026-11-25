import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="page-frame py-16">
      <h1 className="sr-only">Route not found</h1>
      <EmptyState
        code="404 / Route not found"
        title="No module at this address."
        description="The requested route is not part of the Phase 1 GRAINTRACE shell. Return to the factory overview to navigate the available modules."
        actionLabel="Factory overview"
        actionHref="/"
      />
    </div>
  );
}
