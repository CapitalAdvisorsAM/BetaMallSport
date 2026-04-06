import { DataUploadStatus, DataUploadType } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export type JobKind = "EXPORT_EXCEL" | "UPLOAD_CONTRATOS_APPLY";
export type JobStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

type JobPayload = {
  kind: JobKind;
  status: JobStatus;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  startedAt?: string;
  finishedAt?: string;
};

function parsePayload(value: unknown): JobPayload | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return parsePayload(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Partial<JobPayload>;
  if (
    !candidate.kind ||
    (candidate.kind !== "EXPORT_EXCEL" && candidate.kind !== "UPLOAD_CONTRATOS_APPLY") ||
    !candidate.status
  ) {
    return null;
  }
  return candidate as JobPayload;
}

function toEstado(status: JobStatus): DataUploadStatus {
  if (status === "QUEUED") {
    return DataUploadStatus.PENDING;
  }
  if (status === "PROCESSING") {
    return DataUploadStatus.PROCESSING;
  }
  if (status === "SUCCEEDED") {
    return DataUploadStatus.OK;
  }
  return DataUploadStatus.ERROR;
}

export async function createJob(input: {
  projectId: string;
  userId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
}): Promise<string> {
  const jobPayload: JobPayload = {
    kind: input.kind,
    status: "QUEUED",
    input: input.payload,
    progress: 0
  };

  const created = await prisma.dataUpload.create({
    data: {
      projectId: input.projectId,
      type: DataUploadType.BANK,
      userId: input.userId,
      fileName: `JOB::${input.kind}`,
      fileUrl: "internal://jobs",
      status: DataUploadStatus.PENDING,
      errorDetail: JSON.stringify(jobPayload),
      recordsLoaded: 0
    },
    select: { id: true }
  });

  return created.id;
}

export async function getJob(jobId: string): Promise<{
  id: string;
  projectId: string;
  userId: string;
  status: JobStatus;
  kind: JobKind;
  payload: JobPayload;
}> {
  const job = await prisma.dataUpload.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      userId: true,
      fileName: true,
      errorDetail: true
    }
  });
  if (!job || !job.fileName.startsWith("JOB::")) {
    throw new ApiError(404, "Job no encontrado.");
  }
  const payload = parsePayload(job.errorDetail);
  if (!payload) {
    throw new ApiError(422, "Job invalido.");
  }

  return {
    id: job.id,
    projectId: job.projectId,
    userId: job.userId,
    status: payload.status,
    kind: payload.kind,
    payload
  };
}

export async function updateJobStatus(input: {
  jobId: string;
  status: JobStatus;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  const current = await getJob(input.jobId);
  const nextPayload: JobPayload = {
    ...current.payload,
    status: input.status,
    progress: input.progress ?? current.payload.progress ?? 0,
    result: input.result ?? current.payload.result,
    error: input.error,
    startedAt:
      input.status === "PROCESSING"
        ? new Date().toISOString()
        : current.payload.startedAt,
    finishedAt:
      input.status === "SUCCEEDED" || input.status === "FAILED"
        ? new Date().toISOString()
        : undefined
  };

  await prisma.dataUpload.update({
    where: { id: input.jobId },
    data: {
      status: toEstado(input.status),
      errorDetail: JSON.stringify(nextPayload)
    }
  });
}

export async function listQueuedJobs(limit = 10): Promise<Array<{ id: string }>> {
  return prisma.dataUpload.findMany({
    where: {
      type: DataUploadType.BANK,
      status: DataUploadStatus.PENDING,
      fileName: { startsWith: "JOB::" }
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true }
  });
}

