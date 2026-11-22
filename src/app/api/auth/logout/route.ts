import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { revokeSessionToken } from "@/lib/auth/session-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
