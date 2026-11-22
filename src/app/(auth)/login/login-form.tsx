"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoAccountView } from "@/lib/auth/demo-accounts";

const accounts = demoAccountView();

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string>(accounts[0].email);
  const [password, setPassword] = useState<string>(accounts[0].password);
  const [error, setError] = useState<string | null>(notice ?? null);
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
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="mono-label text-obsidian/55">
          Work email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-machine" aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="mono-label text-obsidian/55">
          Password
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-machine" aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="border border-rust/40 bg-rust/5 px-4 py-3 text-sm text-rust">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="dark" size="lg" className="w-full" disabled={pending}>
        {pending ? "Verifying credentials" : "Enter operating console"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      <fieldset className="border-t border-obsidian/15 pt-6">
        <legend className="mono-label text-obsidian/45">Demonstration accounts</legend>
        <div className="mt-3 divide-y divide-obsidian/10">
          {accounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemoAccount(account)}
              className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:text-forest"
            >
              <span className="font-mono text-xs text-obsidian/80">{account.email}</span>
              <span className="mono-label text-machine">{account.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10px] leading-5 text-machine">
          Selecting an account fills the form with its seeded password.
        </p>
      </fieldset>
    </form>
  );
}
