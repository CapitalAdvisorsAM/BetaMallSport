export const dynamic = "force-dynamic";

import { GET as projectsGET, POST as projectsPOST } from "@/app/api/projects/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/projects";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const response = await projectsGET();
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function POST(request: Request): Promise<Response> {
  const response = await projectsPOST(request);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
