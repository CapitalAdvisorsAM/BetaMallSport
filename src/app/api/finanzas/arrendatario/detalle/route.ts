export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeTenantDetailGET } from "@/app/api/finance/tenants/detail/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/tenants/detail";

export async function GET(request: Request): Promise<Response> {
  const response = await financeTenantDetailGET(
    request as Parameters<typeof financeTenantDetailGET>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
