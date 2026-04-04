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
