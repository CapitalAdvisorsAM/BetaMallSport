export const dynamic = "force-dynamic";

import {
  DELETE as unitDELETE,
  GET as unitGET,
  PUT as unitPUT
} from "@/app/api/units/[id]/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

export const runtime = "nodejs";

function buildCanonicalPath(id: string): string {
  return `/api/units/${id}`;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await unitGET(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await unitPUT(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await unitDELETE(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}
