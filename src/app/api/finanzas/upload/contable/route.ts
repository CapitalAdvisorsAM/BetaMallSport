export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { POST as financeUploadAccountingPOST } from "@/app/api/finance/upload/accounting/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/upload/accounting";

export async function POST(request: Request): Promise<Response> {
  const response = await financeUploadAccountingPOST(
    request as Parameters<typeof financeUploadAccountingPOST>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
