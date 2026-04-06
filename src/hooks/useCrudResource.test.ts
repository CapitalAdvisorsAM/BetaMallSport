import { describe, expect, it } from "vitest";
import {
  normalizeCrudError,
  removeCrudRecord,
  upsertCrudRecord
} from "@/hooks/useCrudResource";

type Item = {
  id: string;
  name: string;
};

describe("useCrudResource helpers", () => {
  it("normalizes error messages", () => {
    expect(normalizeCrudError(new Error("boom"), "fallback")).toBe("boom");
    expect(normalizeCrudError(new Error(""), "fallback")).toBe("fallback");
    expect(normalizeCrudError(null, "fallback")).toBe("fallback");
  });

  it("upserts records by id", () => {
    const inserted = upsertCrudRecord<Item>([{ id: "1", name: "A" }], { id: "2", name: "B" }, (row) => row.id);
    expect(inserted).toEqual([
      { id: "1", name: "A" },
      { id: "2", name: "B" }
    ]);

    const updated = upsertCrudRecord<Item>(
      [{ id: "1", name: "A" }, { id: "2", name: "B" }],
      { id: "2", name: "B2" },
      (row) => row.id
    );
    expect(updated).toEqual([
      { id: "1", name: "A" },
      { id: "2", name: "B2" }
    ]);
  });

  it("removes records by id", () => {
    const next = removeCrudRecord<Item>(
      [
        { id: "1", name: "A" },
        { id: "2", name: "B" }
      ],
      "1",
      (row) => row.id
    );
    expect(next).toEqual([{ id: "2", name: "B" }]);
  });
});
