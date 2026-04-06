export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { POST as financeUploadSalesPOST } from "@/app/api/finance/upload/sales/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/upload/sales";

export async function POST(request: Request): Promise<Response> {
  const response = await financeUploadSalesPOST(
    request as Parameters<typeof financeUploadSalesPOST>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
