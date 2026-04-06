export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  DELETE as financeMappingsSalesDELETE,
  GET as financeMappingsSalesGET,
  POST as financeMappingsSalesPOST
} from "@/app/api/finance/mappings/sales/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

const CANONICAL_ENDPOINT = "/api/finance/mappings/sales";

export async function GET(request: Request): Promise<Response> {
  const response = await financeMappingsSalesGET(
    request as Parameters<typeof financeMappingsSalesGET>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function POST(request: Request): Promise<Response> {
  const response = await financeMappingsSalesPOST(
    request as Parameters<typeof financeMappingsSalesPOST>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}

export async function DELETE(request: Request): Promise<Response> {
  const response = await financeMappingsSalesDELETE(
    request as Parameters<typeof financeMappingsSalesDELETE>[0]
  );
  return withDeprecatedEndpointHeaders(response, { canonicalPath: CANONICAL_ENDPOINT });
}
