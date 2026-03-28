import { NextResponse } from "next/server";

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
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ message: "Sin permisos." }, { status: 403 });
    }
  }
  // No exponer detalles internos en producción
  console.error("[API Error]", error);
  return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
}
