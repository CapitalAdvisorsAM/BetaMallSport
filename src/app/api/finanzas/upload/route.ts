export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { POST as financeUploadPOST } from "@/app/api/finance/upload/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/upload";

export async function POST(request: Request): Promise<Response> {
  const response = await financeUploadPOST(request as Parameters<typeof financeUploadPOST>[0]);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
