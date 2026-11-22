import { DUMMY_PASSWORD_HASH } from "./demo-hashes";
import { landingPathFor } from "./permissions";
import { verifyPassword } from "./password";
import { createSession, pruneExpiredSessions } from "./session-store";
import type { ActiveUserRecord } from "./types";
import { findActiveUserByEmail, touchLogin } from "./user-store";
import { loginSchema } from "./validation";

export type LoginResult =
  | {
      ok: true;
      user: ActiveUserRecord;
      token: string;
      expiresAt: string;
      redirectTo: string;
    }
  | { ok: false; error: string };

const INVALID_CREDENTIALS = "Email or password is incorrect.";

export function loginWithCredentials(input: unknown): LoginResult {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }

  const user = findActiveUserByEmail(parsed.data.email);
  const passwordMatches = verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    return { ok: false, error: INVALID_CREDENTIALS };
  }

  pruneExpiredSessions();
  const session = createSession(user.id);
  touchLogin(user.id);

  return {
    ok: true,
    user,
    token: session.token,
    expiresAt: session.expiresAt,
    redirectTo: landingPathFor(user.role),
  };
}
