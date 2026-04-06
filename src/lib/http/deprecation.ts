const DEPRECATION_SUNSET = "Wed, 06 May 2026 00:00:00 GMT";

type DeprecationOptions = {
  canonicalPath: string;
};

export function withDeprecatedEndpointHeaders(
  response: Response,
  options: DeprecationOptions
): Response {
  const headers = new Headers(response.headers);
  headers.set("Deprecation", "true");
  headers.set("Sunset", DEPRECATION_SUNSET);
  headers.set("X-Deprecated-Endpoint", "true");
  headers.set("X-Canonical-Endpoint", options.canonicalPath);
  headers.append("Link", `<${options.canonicalPath}>; rel="successor-version"`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
