import { describe, expect, it } from "vitest";
import { isValidLineKey, toLineKey } from "./line-keys";

describe("toLineKey", () => {
  it("joins parts with dots after the view prefix", () => {
    expect(toLineKey("eerr", "Gastos Operacionales", "Electricidad Compra")).toBe(
      "eerr.gastos-operacionales.electricidad-compra"
    );
  });

  it("normalizes accents", () => {
    expect(toLineKey("eerr", "Energía")).toBe("eerr.energia");
    expect(toLineKey("cdg", "Recuperación")).toBe("cdg.recuperacion");
  });

  it("collapses non-alphanumeric runs into single hyphens and trims edges", () => {
    expect(toLineKey("eerr", "  Foo / Bar -- baz  ")).toBe("eerr.foo-bar-baz");
  });

  it("filters out empty parts", () => {
    expect(toLineKey("eerr", "Foo", "", "Bar")).toBe("eerr.foo.bar");
  });

  it("lowercases all output", () => {
    expect(toLineKey("eerr", "ABC")).toBe("eerr.abc");
  });

  it("handles cdg view", () => {
    expect(toLineKey("cdg", "overall", "Costo Total")).toBe("cdg.overall.costo-total");
  });
});

describe("isValidLineKey", () => {
  it("accepts valid eerr keys", () => {
    expect(isValidLineKey("eerr.gastos.electricidad-compra")).toBe(true);
    expect(isValidLineKey("eerr.x")).toBe(true);
  });

  it("accepts valid cdg keys", () => {
    expect(isValidLineKey("cdg.a-b.c")).toBe(true);
    expect(isValidLineKey("cdg.overall.deficit-uf")).toBe(true);
  });

  it("rejects unknown view prefix", () => {
    expect(isValidLineKey("foo.bar")).toBe(false);
    expect(isValidLineKey("plan.x")).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(isValidLineKey("eerr.Foo")).toBe(false);
  });

  it("rejects keys with leading or trailing hyphens or dots in the slug", () => {
    expect(isValidLineKey("eerr.")).toBe(false);
    expect(isValidLineKey("eerr.-foo")).toBe(false);
    expect(isValidLineKey("eerr.foo-")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidLineKey("")).toBe(false);
  });
});
