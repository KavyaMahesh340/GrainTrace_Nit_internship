import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/access";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user } = requireSession();

  return <AppShell user={user}>{children}</AppShell>;
}
