"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SessionUser } from "@/lib/auth/types";

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("logout failed");
      }

      setOpen(false);
      router.replace("/login?signedOut=1");
      router.refresh();
    } catch {
      setError("Unable to sign out. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="light" size="sm" aria-label="Open profile menu">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden max-w-32 truncate lg:inline">{user.fullName}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md" closeLabel="Close profile">
        <SheetHeader className="border-b border-paper/10 pr-14">
          <SheetTitle>Operating profile</SheetTitle>
          <SheetDescription>GRAINTRACE / SESSION</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="border-b border-paper/10 py-7">
            <p className="mono-label text-paper-muted">Signed in as</p>
            <p className="mt-3 text-2xl font-semibold tracking-tightest">{user.fullName}</p>
            <p className="mt-2 font-mono text-xs text-paper-muted">{user.email}</p>
          </div>
          <dl className="grid grid-cols-2 gap-y-5 border-b border-paper/10 py-7">
            <dt className="mono-label text-paper-muted">Role</dt>
            <dd className="text-right font-mono text-xs text-signal">{user.roleLabel}</dd>
            <dt className="mono-label text-paper-muted">Landing view</dt>
            <dd className="text-right font-mono text-xs text-paper-muted">{user.landingPath}</dd>
            <dt className="mono-label text-paper-muted">Permissions</dt>
            <dd className="text-right font-mono text-xs text-paper-muted tabular">
              {user.permissions.length}
            </dd>
          </dl>
          <div className="py-7">
            <p className="mono-label text-paper-muted">End session</p>
            <p className="mt-3 text-sm leading-7 text-paper-muted">
              Signing out revokes this session on the server and closes the operating console.
            </p>
            {error ? (
              <p role="alert" className="mt-4 border border-rust/50 px-4 py-3 text-sm text-rust">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handleLogout} variant="default" size="lg" disabled={pending}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {pending ? "Signing out" : "Confirm sign out"}
              </Button>
              <SheetClose asChild>
                <Button variant="light" size="lg" disabled={pending}>
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
