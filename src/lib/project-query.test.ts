import { describe, expect, it } from "vitest";
import {
  appendProjectIdQuery,
  appendProjectQuery,
  resolveProjectIdFromQuery
} from "@/lib/project-query";

describe("project-query helpers", () => {
  it("resolves project query param", () => {
    const result = resolveProjectIdFromQuery({ project: "p1" });
    expect(result).toBe("p1");
  });

  it("returns undefined when project is missing", () => {
    const result = resolveProjectIdFromQuery({});
    expect(result).toBeUndefined();
  });

  it("appends project param only", () => {
    const params = appendProjectQuery(new URLSearchParams(), "p1");
    expect(params.get("project")).toBe("p1");
    expect(params.get("proyecto")).toBeNull();
  });

  it("appends projectId param only", () => {
    const params = appendProjectIdQuery(new URLSearchParams(), "p1");
    expect(params.get("projectId")).toBe("p1");
    expect(params.get("proyectoId")).toBeNull();
  });
});
