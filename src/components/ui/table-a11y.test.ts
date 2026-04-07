import { describe, expect, it } from "vitest";
import { mapSortStateToAriaSort } from "@/components/ui/table-a11y";

describe("table a11y helpers", () => {
  it("maps sort state to aria-sort value", () => {
    expect(mapSortStateToAriaSort("asc")).toBe("ascending");
    expect(mapSortStateToAriaSort("desc")).toBe("descending");
    expect(mapSortStateToAriaSort(false)).toBe("none");
  });
});
