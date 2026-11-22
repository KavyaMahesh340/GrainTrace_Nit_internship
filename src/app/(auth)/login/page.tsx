import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
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
      <section className="surface-dark relative overflow-hidden bg-obsidian px-6 py-12 text-paper sm:px-10 lg:col-span-6 lg:py-16">
        <div className="preview-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between gap-16">
          <div>
            <p className="mono-label text-signal">GRAINTRACE / Operating console</p>
            <h1 className="mt-10 max-w-2xl text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[0.9] tracking-tightest">
              Every packet produced. Every gram accounted for.
            </h1>
            <p className="mt-8 max-w-md text-sm leading-7 text-paper/60">
              Sign in to the material journey. Access is scoped by role, and every protected view is
              enforced on the server.
            </p>
          </div>
          <ol className="grid gap-x-6 gap-y-3 border-t border-paper/15 pt-8 font-mono text-[10px] uppercase tracking-label text-paper/45 sm:grid-cols-2">
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
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        </div>
      </section>
      <section className="flex items-center px-6 py-12 sm:px-10 lg:col-span-6 lg:py-16">
        <div className="mx-auto w-full max-w-md">
          <p className="mono-label text-rust">Secure access</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tightest">Sign in to GRAINTRACE</h2>
          <p className="mt-3 text-sm leading-7 text-obsidian/60">
            Use a seeded demonstration account. Roles determine the landing view and visible modules.
          </p>
          <LoginForm notice={notice} />
        </div>
      </section>
    </main>
  );
}
