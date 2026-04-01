import { PAGINATION_DEFAULT, PAGINATION_MAX } from "./constants";

export function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number;
  cursor: string | undefined;
} {
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const safeLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : PAGINATION_DEFAULT;
  const limit = Math.min(safeLimit, PAGINATION_MAX);
  const rawCursor = searchParams.get("cursor");
  const cursor = rawCursor && rawCursor.trim().length > 0 ? rawCursor : undefined;
  return { limit, cursor };
}
