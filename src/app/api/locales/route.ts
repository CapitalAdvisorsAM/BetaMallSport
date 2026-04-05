export const dynamic = "force-dynamic";

import { GET as unitsGET, POST as unitsPOST } from "@/app/api/units/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/units";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const response = await unitsGET(request);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function POST(request: Request): Promise<Response> {
  const response = await unitsPOST(request);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
