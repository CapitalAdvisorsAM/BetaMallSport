import { describe, expect, it } from "vitest";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";

describe("table theme", () => {
  it("resolves density specific spacing tokens", () => {
    const compact = getTableTheme("compact");
    const comfortable = getTableTheme("comfortable");

    expect(compact.headCell).toContain("px-3");
    expect(comfortable.headCell).toContain("px-5");
    expect(compact.cell).not.toEqual(comfortable.cell);
  });

  it("keeps shared visual tokens across densities", () => {
    const compact = getTableTheme("compact");
    const defaults = getTableTheme("default");

    expect(compact.head).toBe(defaults.head);
    expect(compact.surface).toBe(defaults.surface);
  });

  it("returns striped row classes by index and density", () => {
    expect(getStripedRowClass(0, "compact")).toBe("bg-white");
    expect(getStripedRowClass(1, "compact")).toBe("bg-slate-50/60");
  });
});
