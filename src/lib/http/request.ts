import { ApiError } from "@/lib/api-error";
import { parsePaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

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
  return projectId.length > 0 ? projectId : null;
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

async function assertActiveProjectId(projectId: string): Promise<string> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      activo: true
    },
    select: { id: true }
  });

  if (!project) {
    throw new ApiError(404, "Proyecto no encontrado.");
  }

  return project.id;
}

function getBodyProjectId(record: Record<string, unknown>): {
  projectId: string;
  legacyProjectId: string;
} {
  return {
    projectId: typeof record.projectId === "string" ? record.projectId.trim() : "",
    legacyProjectId: typeof record.proyectoId === "string" ? record.proyectoId.trim() : ""
  };
}

export async function getRequiredActiveProjectIdSearchParam(
  searchParams: URLSearchParams
): Promise<string> {
  return assertActiveProjectId(getRequiredProjectIdSearchParam(searchParams));
}

export async function getRequiredActiveProjectIdFromRequest(request: Request): Promise<string> {
  return assertActiveProjectId(getRequiredProjectIdFromRequest(request));
}

export function withCanonicalProjectId<T>(body: T, requestProjectId?: string): T {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return body;
  }

  const record = body as Record<string, unknown>;
  const { projectId, legacyProjectId } = getBodyProjectId(record);

  if (projectId && legacyProjectId && projectId !== legacyProjectId) {
    throw new ApiError(400, "projectId y proyectoId deben coincidir.");
  }

  if (requestProjectId) {
    if (projectId && projectId !== requestProjectId) {
      throw new ApiError(400, "El projectId del request no coincide con el payload.");
    }
    if (legacyProjectId && legacyProjectId !== requestProjectId) {
      throw new ApiError(400, "El projectId del request no coincide con el payload.");
    }

    return {
      ...record,
      projectId: requestProjectId,
      proyectoId: requestProjectId
    } as T;
  }

  if (!projectId && !legacyProjectId) {
    return body;
  }

  const canonicalProjectId = projectId || legacyProjectId;

  return {
    ...record,
    projectId: canonicalProjectId,
    proyectoId: canonicalProjectId
  } as T;
}

export function withNormalizedProjectId<T>(body: T): T {
  return withCanonicalProjectId(body);
}
