import type { Prisma } from "@prisma/client";
import type { RentRollPreviewPayload } from "@/types";

export function parseRentRollPreviewPayload(
  value: Prisma.JsonValue | null | undefined
): RentRollPreviewPayload | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RentRollPreviewPayload;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as unknown as RentRollPreviewPayload;
  }

  return null;
}
