import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";
import { resolveSessionToken } from "./session-store";

export function getSession() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return resolveSessionToken(token);
}
