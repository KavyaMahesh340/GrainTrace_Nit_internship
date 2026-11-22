import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookie";
import { loginWithCredentials } from "@/lib/auth/login";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  const result = loginWithCredentials(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, redirectTo: result.redirectTo });
  setSessionCookie(response, result.token, result.expiresAt);
  return response;
}
