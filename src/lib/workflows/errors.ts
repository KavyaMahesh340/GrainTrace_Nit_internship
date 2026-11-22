import { ZodError } from "zod";
import { DomainError } from "@/domain";
import { WorkflowAuthorizationError } from "./context";

export class WorkflowError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.status = status;
  }
}

export function toWorkflowResponse(error: unknown) {
  if (error instanceof WorkflowAuthorizationError) {
    return { status: error.status, error: error.message, code: "forbidden" };
  }

  if (error instanceof DomainError) {
    return { status: 400, error: error.message, code: error.name };
  }

  if (error instanceof WorkflowError) {
    return { status: error.status, error: error.message, code: error.code };
  }

  if (error instanceof ZodError) {
    return { status: 400, error: error.issues[0]?.message ?? "Enter valid values.", code: "validation_error" };
  }

  return { status: 500, error: "The operation could not be completed.", code: "internal_error" };
}
