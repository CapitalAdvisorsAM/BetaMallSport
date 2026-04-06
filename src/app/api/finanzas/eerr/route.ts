export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeEerrGET } from "@/app/api/finance/eerr/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/eerr";

export async function GET(request: Request): Promise<Response> {
  const response = await financeEerrGET(request as Parameters<typeof financeEerrGET>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
