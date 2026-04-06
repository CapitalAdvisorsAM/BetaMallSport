export type CursorPaginatedResponse<TRecord> = {
  data: TRecord[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function buildCursorPaginatedResponse<TRecord extends { id: string }>(
  items: TRecord[],
  limit: number
): CursorPaginatedResponse<TRecord> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return { data, nextCursor, hasMore };
}
