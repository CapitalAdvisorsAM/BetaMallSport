export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  DELETE as financeMappingsAccountingDELETE,
  GET as financeMappingsAccountingGET,
  POST as financeMappingsAccountingPOST
} from "@/app/api/finance/mappings/accounting/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/mappings/accounting";

export async function GET(request: Request): Promise<Response> {
  const response = await financeMappingsAccountingGET(
    request as Parameters<typeof financeMappingsAccountingGET>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function POST(request: Request): Promise<Response> {
  const response = await financeMappingsAccountingPOST(
    request as Parameters<typeof financeMappingsAccountingPOST>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function DELETE(request: Request): Promise<Response> {
  const response = await financeMappingsAccountingDELETE(
    request as Parameters<typeof financeMappingsAccountingDELETE>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
