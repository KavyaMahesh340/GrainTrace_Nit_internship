import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Notice } from "@/components/system/notice";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { signedOut?: string; expired?: string };
}) {
  const session = getSession();
  if (session.status === "authenticated") {
    redirect(session.user.landingPath);
  }

  const notice = searchParams.signedOut
    ? "You have been signed out."
    : searchParams.expired
      ? "Your previous session expired."
      : undefined;

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-12">
      <section className="surface-dark relative overflow-hidden bg-obsidian px-6 py-12 text-paper sm:px-10 lg:col-span-7 lg:py-16" data-surface="dark">
        <div className="preview-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full border border-paper/10" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between gap-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center bg-signal font-mono text-xs font-bold text-obsidian" aria-hidden="true">G</span>
              <p className="mono-label text-signal">GRAINTRACE / Operating console</p>
            </div>
            <h1 className="mt-10 max-w-3xl text-[clamp(2.75rem,6vw,6rem)] font-semibold leading-[0.88] tracking-tightest text-balance">
              Every packet produced. Every gram accounted for.
            </h1>
            <p className="mt-8 max-w-lg text-sm leading-7 text-paper-muted">
              One continuous record from order to audit. Access is scoped by role, and every protected
              view is enforced on the server.
            </p>
          </div>
          <div>
            <div className="rule-draw h-px w-full bg-paper/20" aria-hidden="true" />
            <ol className="grid gap-x-8 gap-y-4 pt-8 font-mono text-[10px] uppercase tracking-label text-paper-muted sm:grid-cols-2 lg:grid-cols-4">
              {[
                "01 Order",
                "03 Purchase",
                "05 Recipe",
                "06 Production",
                "08 Invoice",
                "09 Dispatch",
                "10 Collection",
                "11 Audit",
              ].map((stage) => (
                <li key={stage} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
                  {stage}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="flex items-center px-6 py-12 sm:px-10 lg:col-span-5 lg:py-16">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between gap-4 border-b border-obsidian/15 pb-5">
            <p className="mono-label text-rust-ink">Secure access</p>
            <p className="mono-caption text-ink-muted">SESSION / 01</p>
          </div>
          <h2 className="mt-8 text-3xl font-semibold tracking-tightest">Sign in to GRAINTRACE</h2>
          <p className="mt-3 text-sm leading-7 text-ink-muted">
            Use a seeded demonstration account. Roles determine the landing view and visible modules.
          </p>
          {notice ? <Notice tone="info" className="mt-6">{notice}</Notice> : null}
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
