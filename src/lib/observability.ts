import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

function writeLog(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
  const encoded = JSON.stringify(payload);
  if (level === "error") {
    console.error(encoded);
    return;
  }
  if (level === "warn") {
    console.warn(encoded);
    return;
  }
  console.log(encoded);
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  writeLog("info", message, data);
}

export function logError(message: string, data?: Record<string, unknown>): void {
  writeLog("error", message, data);
}

export function logDuration(
  operation: string,
  startedAt: number,
  data?: Record<string, unknown>,
  slowThresholdMs = 1_500
): void {
  const elapsedMs = Date.now() - startedAt;
  const isSlow = elapsedMs >= slowThresholdMs;
  writeLog(isSlow ? "warn" : "info", `${operation} completed`, {
    elapsedMs,
    slow: isSlow,
    ...data
  });
}
