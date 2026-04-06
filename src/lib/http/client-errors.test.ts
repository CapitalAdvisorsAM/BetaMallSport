import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "@/lib/http/client-errors";

describe("extractApiErrorMessage", () => {
  it("returns message from json payload", async () => {
    const response = new Response(JSON.stringify({ message: "boom" }), {
      headers: { "content-type": "application/json" }
    });

    await expect(extractApiErrorMessage(response, "fallback")).resolves.toBe("boom");
  });

  it("falls back when content-type is not json", async () => {
    const response = new Response("plain text", {
      headers: { "content-type": "text/plain" }
    });

    await expect(extractApiErrorMessage(response, "fallback")).resolves.toBe("fallback");
  });
});
