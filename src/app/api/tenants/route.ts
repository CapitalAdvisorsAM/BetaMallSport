export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { tenantSchema } from "@/lib/tenants/schema";
import {
  getRequiredProjectIdSearchParam,
  parseRequiredPaginationParams,
  withNormalizedProjectId
} from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { createTenant, listTenantsPage } from "@/lib/tenants/tenant-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const projectId = getRequiredProjectIdSearchParam(searchParams);
    const { limit, cursor } = parseRequiredPaginationParams(searchParams);

    const result = await listTenantsPage({ projectId, limit, cursor });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const result = tenantSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const created = await createTenant({ payload });
    invalidateMetricsCacheByProject(payload.proyectoId);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
