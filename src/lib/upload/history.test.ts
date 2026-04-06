import { describe, expect, it } from "vitest";
import { mapUploadHistory } from "@/lib/upload/history";

describe("mapUploadHistory", () => {
  it("uses fallback registros for finance uploads without preview payload", () => {
    const items = mapUploadHistory(
      [
        {
          id: "1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          fileName: "ventas.xlsx",
          status: "OK",
          recordsLoaded: 12,
          errorDetail: null
        }
      ],
      "updated"
    );

    expect(items[0]).toMatchObject({
      created: 0,
      updated: 12,
      rejected: 0
    });
  });

  it("prefers report counts when a stored modern payload exists", () => {
    const items = mapUploadHistory([
      {
        id: "2",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        fileName: "preview.xlsx",
        status: "OK",
        recordsLoaded: 999,
        errorDetail: {
          rows: [],
          summary: { total: 1, nuevo: 1, actualizado: 0, sinCambio: 0, errores: 0 },
          warnings: [],
          report: {
            created: 5,
            updated: 2,
            skipped: 1,
            rejected: 3,
            rejectedRows: [{ rowNumber: 4, message: "Error" }]
          }
        }
      }
    ]);

    expect(items[0]).toMatchObject({
      created: 5,
      updated: 2,
      rejected: 3
    });
  });
});
