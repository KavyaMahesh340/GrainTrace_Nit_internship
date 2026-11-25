"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, KeyRound, Mail } from "lucide-react";
import { Notice } from "@/components/system/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoAccountView } from "@/lib/auth/demo-accounts";

const accounts = demoAccountView();

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload: { ok?: boolean; error?: string; redirectTo?: string } = await response.json();

      if (!response.ok || !payload.ok || !payload.redirectTo) {
        setError(payload.error ?? "Unable to sign in. Try again.");
        return;
      }

      if (!payload.redirectTo.startsWith("/") || payload.redirectTo.startsWith("//")) {
        setError("Unable to sign in. Try again.");
        return;
      }

      router.replace(payload.redirectTo);
      router.refresh();
    } catch {
      setError("Unable to reach the sign-in service. Try again.");
    } finally {
      setPending(false);
    }
  }

  function fillDemoAccount(account: (typeof accounts)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate={false}>
      <div className="space-y-2">
        <label htmlFor="email" className="mono-label text-ink-muted">
          Work email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 pl-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="mono-label text-ink-muted">
          Password
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 pl-10"
          />
        </div>
      </div>
      {error ? (
        <div id="login-error">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={pending}>
        {pending ? "Verifying credentials" : "Enter operating console"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      <fieldset className="border-t border-obsidian/15 pt-6">
        <legend className="mono-label text-ink-muted">Demonstration accounts</legend>
        <div className="mt-4 grid gap-px bg-obsidian/10">
          {accounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemoAccount(account)}
              className="group flex items-center justify-between gap-3 bg-paper px-3 py-3 text-left transition-colors hover:bg-sage/50"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs text-obsidian">{account.email}</span>
                <span className="mono-caption mt-1 block text-ink-muted">Landing: {account.landingPath}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="border border-obsidian/20 px-2 py-1 font-mono text-[10px] uppercase tracking-label text-ink-muted">
                  {account.role}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10px] leading-5 text-ink-muted">
          Selecting an account fills the form with its seeded password; no account is preselected.
        </p>
      </fieldset>
    </form>
  );
}
