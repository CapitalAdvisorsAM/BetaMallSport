export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeDashboardGET } from "@/app/api/finance/dashboard/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/dashboard";

export async function GET(request: Request): Promise<Response> {
  const response = await financeDashboardGET(request as Parameters<typeof financeDashboardGET>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
