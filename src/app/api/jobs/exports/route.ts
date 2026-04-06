export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { createJob, updateJobStatus } from "@/lib/jobs";
import { requireSession } from "@/lib/permissions";

export const runtime = "nodejs";

type ExportJobBody = {
  dataset?: string;
  scope?: string;
  proyectoId?: string;
  params?: Record<string, string>;
  sync?: boolean;
};

function buildDownloadUrl(input: ExportJobBody): string {
  const dataset = input.dataset?.trim() ?? "";
  const scope = input.scope?.trim() ?? "";
  if (!dataset || !scope) {
    throw new ApiError(400, "dataset y scope son obligatorios.");
  }

  const search = new URLSearchParams({
    dataset,
    scope,
    ...(input.proyectoId ? { proyectoId: input.proyectoId } : {}),
    ...(input.params ?? {})
  });
  search.set("sync", "true");
  return `/api/export/excel?${search.toString()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body = (await request.json()) as ExportJobBody;
    const proyectoId = body.proyectoId?.trim() ?? "";
    if (!proyectoId) {
      throw new ApiError(400, "proyectoId es obligatorio.");
    }

    const downloadUrl = buildDownloadUrl(body);
    const jobId = await createJob({
      proyectoId,
      userId: session.user.id,
      kind: "EXPORT_EXCEL",
      payload: {
        dataset: body.dataset,
        scope: body.scope,
        proyectoId,
        params: body.params ?? {},
        downloadUrl
      }
    });

    if (body.sync === true) {
      await updateJobStatus({ jobId, status: "PROCESSING", progress: 80 });
      await updateJobStatus({
        jobId,
        status: "SUCCEEDED",
        progress: 100,
        result: { downloadUrl }
      });
      return NextResponse.json(
        {
          jobId,
          status: "SUCCEEDED",
          result: { downloadUrl }
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ jobId, status: "QUEUED" }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
