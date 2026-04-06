export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeEerrDetailGET } from "@/app/api/finance/eerr/detail/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/eerr/detail";

export async function GET(request: Request): Promise<Response> {
  const response = await financeEerrDetailGET(request as Parameters<typeof financeEerrDetailGET>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
