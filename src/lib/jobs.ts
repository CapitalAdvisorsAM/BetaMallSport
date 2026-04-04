import { EstadoCargaDatos, TipoCargaDatos } from "@prisma/client";
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

function toEstado(status: JobStatus): EstadoCargaDatos {
  if (status === "QUEUED") {
    return EstadoCargaDatos.PENDIENTE;
  }
  if (status === "PROCESSING") {
    return EstadoCargaDatos.PROCESANDO;
  }
  if (status === "SUCCEEDED") {
    return EstadoCargaDatos.OK;
  }
  return EstadoCargaDatos.ERROR;
}

export async function createJob(input: {
  proyectoId: string;
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

  const created = await prisma.cargaDatos.create({
    data: {
      proyectoId: input.proyectoId,
      tipo: TipoCargaDatos.BANCO,
      usuarioId: input.userId,
      archivoNombre: `JOB::${input.kind}`,
      archivoUrl: "internal://jobs",
      estado: EstadoCargaDatos.PENDIENTE,
      errorDetalle: JSON.stringify(jobPayload),
      registrosCargados: 0
    },
    select: { id: true }
  });

  return created.id;
}

export async function getJob(jobId: string): Promise<{
  id: string;
  proyectoId: string;
  userId: string;
  status: JobStatus;
  kind: JobKind;
  payload: JobPayload;
}> {
  const job = await prisma.cargaDatos.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      proyectoId: true,
      usuarioId: true,
      archivoNombre: true,
      errorDetalle: true
    }
  });
  if (!job || !job.archivoNombre.startsWith("JOB::")) {
    throw new ApiError(404, "Job no encontrado.");
  }
  const payload = parsePayload(job.errorDetalle);
  if (!payload) {
    throw new ApiError(422, "Job invalido.");
  }

  return {
    id: job.id,
    proyectoId: job.proyectoId,
    userId: job.usuarioId,
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

  await prisma.cargaDatos.update({
    where: { id: input.jobId },
    data: {
      estado: toEstado(input.status),
      errorDetalle: JSON.stringify(nextPayload)
    }
  });
}

export async function listQueuedJobs(limit = 10): Promise<Array<{ id: string }>> {
  return prisma.cargaDatos.findMany({
    where: {
      tipo: TipoCargaDatos.BANCO,
      estado: EstadoCargaDatos.PENDIENTE,
      archivoNombre: { startsWith: "JOB::" }
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true }
  });
}
