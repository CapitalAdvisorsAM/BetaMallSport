export const dynamic = "force-dynamic";

import {
  DELETE as tenantDELETE,
  GET as tenantGET,
  PUT as tenantPUT
} from "@/app/api/tenants/[id]/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

export const runtime = "nodejs";

function buildCanonicalPath(id: string): string {
  return `/api/tenants/${id}`;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await tenantGET(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await tenantPUT(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await tenantDELETE(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}
