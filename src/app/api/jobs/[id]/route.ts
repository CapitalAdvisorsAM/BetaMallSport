export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getJob } from "@/lib/jobs";
import { requireSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const job = await getJob(context.params.id);

    return NextResponse.json({
      id: job.id,
      kind: job.kind,
      status: job.status,
      progress: job.payload.progress ?? 0,
      input: job.payload.input,
      result: job.payload.result ?? null,
      error: job.payload.error ?? null,
      startedAt: job.payload.startedAt ?? null,
      finishedAt: job.payload.finishedAt ?? null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
