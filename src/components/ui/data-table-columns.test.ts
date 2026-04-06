import { describe, expect, it } from "vitest";
import {
  enumFilterColumn,
  enumFilterPredicate,
  numberFilterColumn,
  statusBadgeColumn
} from "@/components/ui/data-table-columns";

type DemoRow = {
  status: string;
  amount: number;
};

describe("data-table column helpers", () => {
  it("evaluates enum filter predicate", () => {
    expect(enumFilterPredicate("ACTIVO", ["ACTIVO"])).toBe(true);
    expect(enumFilterPredicate("ACTIVO", ["INACTIVO"])).toBe(false);
    expect(enumFilterPredicate("ACTIVO", [])).toBe(true);
  });

  it("builds enum filter column metadata", () => {
    const column = enumFilterColumn<DemoRow>({
      accessorKey: "status",
      header: "Estado",
      options: ["ACTIVO", "INACTIVO"]
    });

    expect(column.meta).toMatchObject({
      filterType: "enum",
      filterOptions: ["ACTIVO", "INACTIVO"]
    });
    expect(typeof column.filterFn).toBe("function");
  });

  it("builds number filter column metadata", () => {
    const column = numberFilterColumn<DemoRow>({
      accessorKey: "amount",
      header: "Monto"
    });

    expect(column.filterFn).toBe("inNumberRange");
    expect(column.meta).toMatchObject({
      filterType: "number",
      align: "right"
    });
  });

  it("builds status badge column with enum filters", () => {
    const column = statusBadgeColumn<DemoRow>({
      accessorKey: "status",
      header: "Estado",
      options: ["ACTIVO", "INACTIVO"],
      getValue: (row) => row.status,
      getClassName: (value) => (value === "ACTIVO" ? "ok" : "ko")
    });

    expect(column.meta).toMatchObject({
      filterType: "enum",
      filterOptions: ["ACTIVO", "INACTIVO"]
    });
    expect(typeof column.cell).toBe("function");
  });
});
