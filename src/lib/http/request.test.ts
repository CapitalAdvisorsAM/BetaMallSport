import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import {
  getOptionalBooleanSearchParam,
  getRequiredSearchParam,
  parseRequiredPaginationParams
} from "@/lib/http/request";

describe("http/request helpers", () => {
  it("throws when required search param is missing", () => {
    expect(() => getRequiredSearchParam(new URLSearchParams(), "proyectoId")).toThrow(ApiError);
  });

  it("parses required pagination params", () => {
    const result = parseRequiredPaginationParams(new URLSearchParams("limit=25&cursor=abc"));
    expect(result).toEqual({ limit: 25, cursor: "abc" });
  });

  it("throws when limit is missing for required pagination", () => {
    expect(() => parseRequiredPaginationParams(new URLSearchParams("cursor=abc"))).toThrow(ApiError);
  });

  it("parses optional boolean params", () => {
    expect(getOptionalBooleanSearchParam(new URLSearchParams("sync=true"), "sync")).toBe(true);
    expect(getOptionalBooleanSearchParam(new URLSearchParams("sync=0"), "sync")).toBe(false);
    expect(getOptionalBooleanSearchParam(new URLSearchParams(), "sync")).toBeUndefined();
  });
});
