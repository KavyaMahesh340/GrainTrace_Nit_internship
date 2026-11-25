import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/access";

export const metadata: Metadata = {
  title: "Access restricted",
};

export default function UnauthorizedPage() {
  const { user } = requireSession();

  return (
    <div className="page-frame py-16">
      <h1 className="sr-only">Access restricted</h1>
      <EmptyState
        code="403 / Access restricted"
        title="This module is outside your role."
        description={`${user.roleLabel} access does not include this part of the material journey. Return to your landing view or contact an administrator if the role assignment is wrong.`}
        actionLabel={`Back to ${user.roleLabel} landing`}
        actionHref={user.landingPath}
      />
    </div>
  );
}
