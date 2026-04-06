type ErrorPayload = {
  message?: string;
};

export async function extractApiErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fallbackMessage;
  }

  try {
    const data = (await response.json()) as ErrorPayload;
    return data.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
