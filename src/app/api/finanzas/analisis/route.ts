export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { GET as financeAnalysisGET } from "@/app/api/finance/analysis/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/analysis";

export async function GET(request: Request): Promise<Response> {
  const response = await financeAnalysisGET(request as Parameters<typeof financeAnalysisGET>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
