export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getOptionalBooleanSearchParam } from "@/lib/http/request";
import { getRequestId, logDuration, logError } from "@/lib/observability";
import { runContratosApplyJob } from "@/lib/rent-roll/contracts-apply-job";
import { requireWriteAccess } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  try {
    const session = await requireWriteAccess();
    const { searchParams } = new URL(request.url);
    const sync = getOptionalBooleanSearchParam(searchParams, "sync") ?? true;
    if (!sync) {
      return NextResponse.json(
        {
          message: "Modo asincrono disponible via POST /api/jobs/uploads."
        },
        { status: 409 }
      );
    }
    const body = (await request.json()) as { cargaId?: string };
    const cargaId = body.cargaId ?? "";

    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const result = await runContratosApplyJob({
      cargaId,
      userId: session.user.id
    });
    logDuration("rent_roll_upload_contratos_apply", startedAt, {
      requestId,
      cargaId,
      created: result.report.created,
      updated: result.report.updated,
      rejected: result.report.rejected
    });

    return NextResponse.json({
      cargaId: result.cargaId,
      report: result.report
    });
  } catch (error) {
    logError("rent_roll_upload_contratos_apply_failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return handleApiError(error);
  }
}
