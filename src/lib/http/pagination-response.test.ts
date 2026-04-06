import { describe, expect, it } from "vitest";
import { buildCursorPaginatedResponse } from "@/lib/http/pagination-response";

describe("buildCursorPaginatedResponse", () => {
  it("returns nextCursor when there are more records", () => {
    const result = buildCursorPaginatedResponse(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      2
    );

    expect(result).toEqual({
      data: [{ id: "a" }, { id: "b" }],
      nextCursor: "b",
      hasMore: true
    });
  });

  it("returns null nextCursor when page is complete", () => {
    const result = buildCursorPaginatedResponse([{ id: "a" }, { id: "b" }], 2);
    expect(result).toEqual({
      data: [{ id: "a" }, { id: "b" }],
      nextCursor: null,
      hasMore: false
    });
  });
});
