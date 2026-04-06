import { describe, expect, it } from "vitest";
import {
  appendProjectIdQuery,
  appendProjectQuery,
  resolveProjectIdFromQuery
} from "@/lib/project-query";

describe("project-query helpers", () => {
  it("prefers canonical project query param", () => {
    const result = resolveProjectIdFromQuery({ project: "p1", proyecto: "legacy" });
    expect(result).toBe("p1");
  });

  it("falls back to legacy project query param", () => {
    const result = resolveProjectIdFromQuery({ proyecto: "legacy" });
    expect(result).toBe("legacy");
  });

  it("appends canonical and legacy dashboard params", () => {
    const params = appendProjectQuery(new URLSearchParams(), "p1");
    expect(params.get("project")).toBe("p1");
    expect(params.get("proyecto")).toBe("p1");
  });

  it("appends canonical and legacy api params", () => {
    const params = appendProjectIdQuery(new URLSearchParams(), "p1");
    expect(params.get("projectId")).toBe("p1");
    expect(params.get("proyectoId")).toBe("p1");
  });
});
