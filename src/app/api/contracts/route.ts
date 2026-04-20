export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createContractCommand } from "@/lib/contracts/contract-command-service";
import { applyEstadoComputado, listContractsPage } from "@/lib/contracts/contract-query-service";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import {
  getRequiredActiveProjectIdFromRequest,
  getRequiredActiveProjectIdSearchParam,
  parseRequiredPaginationParams,
  withCanonicalProjectId
} from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const projectId = await getRequiredActiveProjectIdSearchParam(searchParams);

    const { limit, cursor } = parseRequiredPaginationParams(searchParams);
    const result = await listContractsPage({ projectId, limit, cursor });
    return NextResponse.json({ ...result, data: applyEstadoComputado(result.data) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);
    const parsed = contractPayloadSchema.safeParse(
      withCanonicalProjectId(await request.json(), projectId)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message, issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const payload = parsed.data;
    const contract = await createContractCommand({ payload, userId: session.user.id });
    invalidateMetricsCacheByProject(payload.proyectoId);

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
