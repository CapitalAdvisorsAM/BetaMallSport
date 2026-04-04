import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (
    error instanceof UnauthorizedError ||
    (error instanceof Error && error.name === "UnauthorizedError")
  ) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }
  if (
    error instanceof ForbiddenError ||
    (error instanceof Error && error.name === "ForbiddenError")
  ) {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }
  if (
    error instanceof ValidationError ||
    (error instanceof Error && error.name === "ValidationError")
  ) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  // No exponer detalles internos en produccion
  console.error("[API Error]", error);
  return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
}
