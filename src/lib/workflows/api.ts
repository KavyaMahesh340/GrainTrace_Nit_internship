import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { WorkflowActor } from "./context";
import { toWorkflowResponse } from "./errors";

export function requireApiActor(permission: Permission): WorkflowActor | NextResponse {
  const session = getSession();

  if (session.status !== "authenticated") {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }

  if (!session.user.permissions.includes(permission)) {
    return NextResponse.json({ ok: false, error: "You do not have access to this action." }, { status: 403 });
  }

  return {
    userId: session.user.id,
    factoryId: session.user.factoryId,
    email: session.user.email,
    role: session.user.role,
    permissions: session.user.permissions,
    sessionId: session.sessionId,
  };
}

export async function readApiJson(request: Request): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Enter a valid JSON body." }, { status: 400 });
  }
}

export function apiErrorResponse(error: unknown) {
  const result = toWorkflowResponse(error);
  return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: result.status });
}
