import { ApiError } from "@/lib/api-error";
import { parsePaginationParams } from "@/lib/pagination";

export function getRequiredSearchParam(searchParams: URLSearchParams, key: string): string {
  const value = searchParams.get(key)?.trim() ?? "";
  if (!value) {
    throw new ApiError(400, `${key} es obligatorio.`);
  }
  return value;
}

export function getOptionalBooleanSearchParam(
  searchParams: URLSearchParams,
  key: string
): boolean | undefined {
  const value = searchParams.get(key);
  if (value === null) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new ApiError(400, `${key} debe ser true o false.`);
}

export function parseRequiredPaginationParams(searchParams: URLSearchParams): {
  limit: number;
  cursor: string | undefined;
} {
  if (!searchParams.has("limit")) {
    throw new ApiError(400, "limit es obligatorio para paginar.");
  }
  return parsePaginationParams(searchParams);
}

export function getProjectIdSearchParam(searchParams: URLSearchParams): string | null {
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  if (projectId.length > 0) {
    return projectId;
  }

  const legacyProjectId = searchParams.get("proyectoId")?.trim() ?? "";
  return legacyProjectId.length > 0 ? legacyProjectId : null;
}

export function getRequiredProjectIdSearchParam(searchParams: URLSearchParams): string {
  const projectId = getProjectIdSearchParam(searchParams);
  if (!projectId) {
    throw new ApiError(400, "projectId es obligatorio.");
  }
  return projectId;
}

export function getProjectIdFromRequest(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  return getProjectIdSearchParam(searchParams);
}

export function getRequiredProjectIdFromRequest(request: Request): string {
  const projectId = getProjectIdFromRequest(request);
  if (!projectId) {
    throw new ApiError(400, "projectId es obligatorio.");
  }
  return projectId;
}

export function withNormalizedProjectId<T>(body: T): T {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return body;
  }

  const record = body as Record<string, unknown>;
  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  const legacyProjectId = typeof record.proyectoId === "string" ? record.proyectoId.trim() : "";

  if (projectId && !legacyProjectId) {
    return {
      ...record,
      proyectoId: projectId
    } as T;
  }

  return body;
}
