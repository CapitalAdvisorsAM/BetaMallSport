import { describe, expect, it } from "vitest";
import { PAGINATION_DEFAULT, PAGINATION_MAX } from "@/lib/constants";
import { parsePaginationParams } from "@/lib/pagination";

describe("parsePaginationParams", () => {
  it("falls back to default when limit is missing", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(PAGINATION_DEFAULT);
    expect(result.cursor).toBeUndefined();
  });

  it("falls back to default when limit is invalid, zero or negative", () => {
    const invalidValues = ["foo", "0", "-10"];

    for (const value of invalidValues) {
      const params = new URLSearchParams({ limit: value });
      const result = parsePaginationParams(params);
      expect(result.limit).toBe(PAGINATION_DEFAULT);
    }
  });

  it("clamps limit to max", () => {
    const params = new URLSearchParams({ limit: String(PAGINATION_MAX + 100) });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(PAGINATION_MAX);
  });

  it("accepts valid positive limits and trims empty cursor", () => {
    const params = new URLSearchParams({ limit: "25", cursor: "  " });
    const result = parsePaginationParams(params);

    expect(result.limit).toBe(25);
    expect(result.cursor).toBeUndefined();
  });
});
