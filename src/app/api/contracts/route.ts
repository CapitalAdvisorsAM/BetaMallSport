export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createContractCommand } from "@/lib/contracts/contract-command-service";
import { listContractsPage } from "@/lib/contracts/contract-query-service";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { getRequiredSearchParam, parseRequiredPaginationParams } from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = getRequiredSearchParam(searchParams, "proyectoId");

    const { limit, cursor } = parseRequiredPaginationParams(searchParams);
    const result = await listContractsPage({ proyectoId, limit, cursor });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const parsed = contractPayloadSchema.safeParse(await request.json());
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
