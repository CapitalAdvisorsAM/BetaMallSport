export const dynamic = "force-dynamic";

import { GET as tenantsGET, POST as tenantsPOST } from "@/app/api/tenants/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/tenants";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const response = await tenantsGET(request);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function POST(request: Request): Promise<Response> {
  const response = await tenantsPOST(request);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
