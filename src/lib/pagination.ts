import { PAGINATION_DEFAULT, PAGINATION_MAX } from "./constants";

export function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number;
  cursor: string | undefined;
} {
  const limit = Math.min(Number(searchParams.get("limit") ?? PAGINATION_DEFAULT), PAGINATION_MAX);
  const cursor = searchParams.get("cursor") ?? undefined;
  return { limit, cursor };
}