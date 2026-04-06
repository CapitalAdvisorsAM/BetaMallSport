import { describe, expect, it } from "vitest";
import {
  alignPrimaryLocalId,
  buildLocalSelectionState,
  normalizeLocalIds,
  toggleLocalSelection
} from "@/components/contracts/local-selection";

describe("local-selection", () => {
  const locals = [
    { id: "loc-1", label: "123" },
    { id: "loc-2", label: "124/125" },
    { id: "loc-3", label: "126A" }
  ];

  it("separates selected locals into valid and missing", () => {
    const state = buildLocalSelectionState({
      locals,
      selectedLocalIds: ["loc-1", "L-102", "loc-1"],
      search: "",
      onlySelected: false
    });

    expect(state.normalizedSelectedIds).toEqual(["loc-1", "L-102"]);
    expect(state.validSelectedIds).toEqual(["loc-1"]);
    expect(state.missingSelectedIds).toEqual(["L-102"]);
  });

  it("filters by search text case-insensitively", () => {
    const state = buildLocalSelectionState({
      locals,
      selectedLocalIds: [],
      search: "124",
      onlySelected: false
    });

    expect(state.filteredLocals.map((local) => local.id)).toEqual(["loc-2"]);
  });

  it("shows only selected locals when onlySelected is enabled", () => {
    const state = buildLocalSelectionState({
      locals,
      selectedLocalIds: ["loc-1", "loc-3", "L-999"],
      search: "",
      onlySelected: true
    });

    expect(state.filteredLocals.map((local) => local.id)).toEqual(["loc-1", "loc-3"]);
  });

  it("aligns primary local to first valid when current is invalid", () => {
    const aligned = alignPrimaryLocalId("L-102", ["loc-2", "loc-3"]);
    expect(aligned).toBe("loc-2");
  });

  it("normalizes ids and supports toggle on/off", () => {
    expect(normalizeLocalIds(["", "loc-1", "loc-1", " loc-2 "])).toEqual(["loc-1", "loc-2"]);

    const added = toggleLocalSelection(["loc-1"], "loc-2", true);
    const removed = toggleLocalSelection(added, "loc-1", false);

    expect(added).toEqual(["loc-1", "loc-2"]);
    expect(removed).toEqual(["loc-2"]);
  });
});
