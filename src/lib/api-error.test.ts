import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { ApiError, handleApiError } from "@/lib/api-error";

describe("handleApiError", () => {
  it("maps ApiError to custom status", async () => {
    const response = handleApiError(new ApiError(418, "teapot"));
    expect(response.status).toBe(418);
    await expect(response.json()).resolves.toEqual({ message: "teapot" });
  });

  it("maps UnauthorizedError to 401", async () => {
    const response = handleApiError(new UnauthorizedError("no auth"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "no auth" });
  });

  it("maps ForbiddenError to 403", async () => {
    const response = handleApiError(new ForbiddenError("forbidden"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "forbidden" });
  });

  it("maps ValidationError to 400", async () => {
    const response = handleApiError(new ValidationError("bad payload"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "bad payload" });
  });
});
