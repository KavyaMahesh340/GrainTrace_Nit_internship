import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasPermission, landingPathFor } from "@/lib/auth/permissions";
import { loginWithCredentials } from "@/lib/auth/login";
import {
  hashSessionToken,
  resolveSessionToken,
  revokeSessionToken,
} from "@/lib/auth/session-store";
import { sessions, users } from "@/lib/db/schema";
import { prepareDatabase } from "./database";

const db = prepareDatabase();

describe("authentication", () => {
  beforeAll(() => {
    prepareDatabase();
  });

  it("hashes and verifies passwords", () => {
    const password = "ValidationPass!2026";
    const hash = hashPassword(password);

    expect(hash).not.toBe(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("WrongPassword!2026", hash)).toBe(false);
  });

  it("rejects malformed credentials with a generic validation message", () => {
    const result = loginWithCredentials({ email: "not-an-email", password: "short" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Enter a valid email and password.");
    }
  });

  it("returns the same generic error for unknown email and wrong password", () => {
    const unknown = loginWithCredentials({
      email: "nobody@graintrace.local",
      password: "WrongPassword!2026",
    });
    const wrongPassword = loginWithCredentials({
      email: "salesman@graintrace.local",
      password: "WrongPassword!2026",
    });

    expect(unknown.ok).toBe(false);
    expect(wrongPassword.ok).toBe(false);
    if (!unknown.ok && !wrongPassword.ok) {
      expect(unknown.error).toBe(wrongPassword.error);
      expect(unknown.error).toBe("Email or password is incorrect.");
    }
  });

  it("signs in a seeded user and returns a role-specific landing path", () => {
    const result = loginWithCredentials({
      email: "salesman@graintrace.local",
      password: "Sales!2026",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectTo).toBe("/orders");
      expect(result.token).toMatch(/^[a-f0-9]{64}$/);

      const session = resolveSessionToken(result.token);
      expect(session.status).toBe("authenticated");
      if (session.status === "authenticated") {
        expect(session.user.email).toBe("salesman@graintrace.local");
        expect(session.user.role).toBe("salesman");
        expect(session.user.permissions).toContain("orders:manage");
        expect(session.user.permissions).not.toContain("production:manage");
      }
    }
  });

  it("signs in the seeded auditor role", () => {
    const result = loginWithCredentials({
      email: "auditor@graintrace.local",
      password: "Auditor!2026",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const session = resolveSessionToken(result.token);
      expect(session.status).toBe("authenticated");
      if (session.status === "authenticated") {
        expect(session.user.role).toBe("auditor");
        expect(session.user.permissions).toContain("audit:view");
        expect(session.user.permissions).not.toContain("orders:manage");
      }
    }
  });

  it("rejects absent, malformed, expired, and revoked sessions", () => {
    expect(resolveSessionToken(undefined).status).toBe("absent");
    expect(resolveSessionToken("not-a-token").status).toBe("invalid");

    const expiredLogin = loginWithCredentials({
      email: "owner@graintrace.local",
      password: "Owner!2026",
    });
    expect(expiredLogin.ok).toBe(true);
    if (expiredLogin.ok) {
      const session = db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, hashSessionToken(expiredLogin.token)))
        .get();
      expect(session).toBeDefined();
      if (session) {
        db.update(sessions)
          .set({ expiresAt: "2000-01-01T00:00:00.000Z" })
          .where(eq(sessions.id, session.id))
          .run();
      }
      expect(resolveSessionToken(expiredLogin.token).status).toBe("invalid");
    }

    const revokedLogin = loginWithCredentials({
      email: "admin@graintrace.local",
      password: "Admin!2026",
    });
    expect(revokedLogin.ok).toBe(true);
    if (revokedLogin.ok) {
      revokeSessionToken(revokedLogin.token);
      expect(resolveSessionToken(revokedLogin.token).status).toBe("invalid");
    }
  });

  it("enforces the documented permission matrix on the server", () => {
    expect(hasPermission("salesman", "orders:view")).toBe(true);
    expect(hasPermission("salesman", "production:manage")).toBe(false);
    expect(hasPermission("production", "production:manage")).toBe(true);
    expect(hasPermission("accountant", "invoices:manage")).toBe(true);
    expect(landingPathFor("accountant")).toBe("/invoices");
  });

  it("rejects duplicate user emails at the database boundary", () => {
    const existing = db.select().from(users).where(eq(users.email, "owner@graintrace.local")).get();
    expect(existing).toBeDefined();
    if (!existing) {
      return;
    }

    expect(() =>
      db
        .insert(users)
        .values({
          factoryId: existing.factoryId,
          roleId: existing.roleId,
          email: existing.email,
          fullName: "Duplicate User",
          passwordHash: existing.passwordHash,
          status: "active",
        })
        .run(),
    ).toThrow();
  });
});
