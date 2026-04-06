export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeTenantsGET } from "@/app/api/finance/tenants/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/tenants";

export async function GET(request: Request): Promise<Response> {
  const response = await financeTenantsGET(request as Parameters<typeof financeTenantsGET>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
