import { describe, expect, it } from "vitest";
import { noteCreateSchema, noteListQuerySchema, noteUpdateSchema } from "./schema";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("noteCreateSchema", () => {
  const base = {
    projectId: validUuid,
    lineKey: "eerr.gastos.electricidad-compra",
    view: "EERR" as const,
    body: "Subió 8% versus el mes pasado."
  };

  it("accepts a valid payload", () => {
    expect(noteCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid lineKey shape", () => {
    const result = noteCreateSchema.safeParse({ ...base, lineKey: "foo.bar" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = noteCreateSchema.safeParse({ ...base, body: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a body longer than 5000 characters", () => {
    const result = noteCreateSchema.safeParse({ ...base, body: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown view", () => {
    const result = noteCreateSchema.safeParse({ ...base, view: "PLAN" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid projectId", () => {
    const result = noteCreateSchema.safeParse({ ...base, projectId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace around the body", () => {
    const result = noteCreateSchema.safeParse({ ...base, body: "   hola   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBe("hola");
    }
  });
});

describe("noteUpdateSchema", () => {
  it("accepts a body-only update", () => {
    const result = noteUpdateSchema.safeParse({ body: "edit" });
    expect(result.success).toBe(true);
  });

  it("accepts a status-only update", () => {
    const result = noteUpdateSchema.safeParse({ status: "RESOLVED" });
    expect(result.success).toBe(true);
  });

  it("accepts both body and status together", () => {
    const result = noteUpdateSchema.safeParse({ body: "x", status: "OPEN" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty payload", () => {
    const result = noteUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = noteUpdateSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(false);
  });
});

describe("noteListQuerySchema", () => {
  it("requires projectId", () => {
    expect(noteListQuerySchema.safeParse({}).success).toBe(false);
  });

  it("accepts only projectId", () => {
    expect(noteListQuerySchema.safeParse({ projectId: validUuid }).success).toBe(true);
  });

  it("accepts optional view, lineKey, status filters", () => {
    const result = noteListQuerySchema.safeParse({
      projectId: validUuid,
      view: "CDG",
      lineKey: "cdg.overall.deficit-uf",
      status: "OPEN"
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid lineKey filter", () => {
    const result = noteListQuerySchema.safeParse({
      projectId: validUuid,
      lineKey: "FOO"
    });
    expect(result.success).toBe(false);
  });
});
