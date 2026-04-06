export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { createJob, updateJobStatus } from "@/lib/jobs";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runContratosApplyJob } from "@/lib/rent-roll/contracts-apply-job";

export const runtime = "nodejs";

type UploadJobBody = {
  kind?: "contratos_apply";
  cargaId?: string;
  sync?: boolean;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = (await request.json()) as UploadJobBody;
    const cargaId = body.cargaId?.trim() ?? "";
    if (!cargaId) {
      throw new ApiError(400, "cargaId es obligatorio.");
    }

    const carga = await prisma.cargaDatos.findUnique({
      where: { id: cargaId },
      select: { id: true, proyectoId: true }
    });
    if (!carga) {
      throw new ApiError(404, "Carga no encontrada.");
    }

    if ((body.kind ?? "contratos_apply") !== "contratos_apply") {
      throw new ApiError(400, "kind no soportado.");
    }

    const jobId = await createJob({
      proyectoId: carga.proyectoId,
      userId: session.user.id,
      kind: "UPLOAD_CONTRATOS_APPLY",
      payload: {
        cargaId
      }
    });

    const sync = body.sync === true;
    if (sync) {
      await updateJobStatus({ jobId, status: "PROCESSING", progress: 10 });
      const result = await runContratosApplyJob({ cargaId, userId: session.user.id });
      await updateJobStatus({
        jobId,
        status: "SUCCEEDED",
        progress: 100,
        result: {
          cargaId: result.cargaId,
          report: result.report
        }
      });
      return NextResponse.json({ jobId, status: "SUCCEEDED", result }, { status: 200 });
    }

    return NextResponse.json({ jobId, status: "QUEUED" }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
