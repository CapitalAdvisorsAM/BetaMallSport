export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getJob, listQueuedJobs, updateJobStatus } from "@/lib/jobs";
import { getRequestId, logDuration, logError } from "@/lib/observability";
import { requireWriteAccess } from "@/lib/permissions";
import { runContratosApplyJob } from "@/lib/plan/contracts-apply-job";

export const runtime = "nodejs";

type WorkerBody = {
  jobId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  try {
    await requireWriteAccess();
    const body = (await request.json().catch(() => ({}))) as WorkerBody;
    const targetJobIds = body.jobId ? [{ id: body.jobId }] : await listQueuedJobs(1);
    if (targetJobIds.length === 0) {
      return NextResponse.json({ processed: 0, message: "No hay jobs en cola." });
    }

    const outputs: Array<{ jobId: string; status: string; message?: string }> = [];
    for (const item of targetJobIds) {
      const job = await getJob(item.id);
      await updateJobStatus({ jobId: job.id, status: "PROCESSING", progress: 20 });

      try {
        if (job.kind === "UPLOAD_CONTRATOS_APPLY") {
          const cargaId = String(job.payload.input.cargaId ?? "");
          if (!cargaId) {
            throw new ApiError(400, "Job upload sin cargaId.");
          }
          const result = await runContratosApplyJob({
            cargaId,
            userId: job.userId
          });
          await updateJobStatus({
            jobId: job.id,
            status: "SUCCEEDED",
            progress: 100,
            result: {
              cargaId: result.cargaId,
              report: result.report
            }
          });
          outputs.push({ jobId: job.id, status: "SUCCEEDED" });
          continue;
        }

        const downloadUrl = String(job.payload.input.downloadUrl ?? "");
        await updateJobStatus({
          jobId: job.id,
          status: "SUCCEEDED",
          progress: 100,
          result: { downloadUrl }
        });
        outputs.push({ jobId: job.id, status: "SUCCEEDED" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        await updateJobStatus({
          jobId: job.id,
          status: "FAILED",
          error: message
        });
        outputs.push({ jobId: job.id, status: "FAILED", message });
      }
    }

    logDuration("jobs_worker", startedAt, { requestId, processed: outputs.length });
    return NextResponse.json({ processed: outputs.length, outputs });
  } catch (error) {
    logError("jobs_worker_failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return handleApiError(error);
  }
}
