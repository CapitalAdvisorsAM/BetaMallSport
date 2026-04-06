export const dynamic = "force-dynamic";

import {
  DELETE as projectDELETE,
  GET as projectGET,
  PUT as projectPUT
} from "@/app/api/projects/[id]/route";
import { withDeprecatedEndpointHeaders } from "@/lib/http/deprecation";

export const runtime = "nodejs";

function buildCanonicalPath(id: string): string {
  return `/api/projects/${id}`;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await projectGET(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await projectPUT(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const response = await projectDELETE(request, context);
  return withDeprecatedEndpointHeaders(response, { canonicalPath: buildCanonicalPath(context.params.id) });
}
