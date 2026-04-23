export const dynamic = "force-dynamic";

import { MasterStatus, Prisma, DataUploadType, UnitType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseStoredUploadPayload } from "@/lib/upload/payload";
import type { ApplyReport } from "@/types/upload";

export const runtime = "nodejs";

type NormalizedLocalRow = {
  codigo: string;
  nombre: string;
  glam2: string;
  piso: string;
  tipo: UnitType;
  zona: string | null;
  esGLA: boolean;
  estado: MasterStatus;
};

const allowedTipo = new Set(Object.values(UnitType));
const allowedEstado = new Set(Object.values(MasterStatus));
const tipoAliases: Record<string, UnitType> = {
  LOCAL_COMERCIAL: UnitType.LOCAL_COMERCIAL,
  TIENDA: UnitType.LOCAL_COMERCIAL,
  SIMULADOR: UnitType.SIMULADOR,
  MODULO: UnitType.MODULO,
  ESPACIO: UnitType.ESPACIO,
  BODEGA: UnitType.BODEGA,
  OTRO: UnitType.OTRO
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeLocalData(data: Record<string, unknown>): NormalizedLocalRow | null {
  const codigo = asString(data.codigo).toUpperCase();
  const nombre = asString(data.nombre) || codigo;
  const glam2Raw = asString(data.glam2).replace(",", ".");
  const glam2 = glam2Raw || "0";
  const piso = asString(data.piso);
  const tipoRaw = normalizeToken(asString(data.tipo) || asString(data.type));
  const estado = normalizeToken(asString(data.estado) || asString(data.status)) || MasterStatus.ACTIVO;
  const zona = asString(data.zona);
  const esGLA = Boolean(data.esGLA);

  if (!codigo || !piso) {
    return null;
  }
  const tipo = tipoAliases[tipoRaw];
  if (!tipo || !allowedTipo.has(tipo) || !allowedEstado.has(estado as MasterStatus)) {
    return null;
  }
  if (!Number.isFinite(Number(glam2)) || Number(glam2) < 0) {
    return null;
  }

  return {
    codigo,
    nombre,
    glam2,
    piso,
    tipo,
    zona: zona || null,
    esGLA,
    estado: estado as MasterStatus
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let processingCargaId: string | null = null;
  try {
    const session = await requireWriteAccess();
    const body = (await request.json()) as { cargaId?: string };
    const cargaId = body.cargaId ?? "";

    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.dataUpload.findUnique({ where: { id: cargaId } });
    if (!carga || carga.type !== DataUploadType.UNITS) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }
    if (carga.status === "PROCESSING") {
      return NextResponse.json({ message: "La carga ya esta siendo procesada." }, { status: 409 });
    }

    const payload = parseStoredUploadPayload(carga.errorDetail);
    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el preview para esta carga." }, { status: 422 });
    }

    await prisma.dataUpload.update({
      where: { id: carga.id },
      data: { status: "PROCESSING", userId: session.user.id }
    });
    processingCargaId = carga.id;

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows: ApplyReport["rejectedRows"] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of payload.rows) {
        if (row.status === "ERROR") {
          rejectedRows.push({
            rowNumber: row.rowNumber,
            message: row.errorMessage ?? "Fila invalida en preview."
          });
          continue;
        }

        if (row.status === "UNCHANGED") {
          skipped += 1;
          continue;
        }

        const normalized = normalizeLocalData(row.data);
        if (!normalized) {
          rejectedRows.push({
            rowNumber: row.rowNumber,
            message: "No se pudo normalizar la fila para aplicar."
          });
          continue;
        }

        const zonaRecord = normalized.zona
          ? await tx.zone.findFirst({
              where: { projectId: carga.projectId, nombre: normalized.zona },
              select: { id: true }
            })
          : null;

        const localData = {
          nombre: normalized.nombre,
          glam2: new Prisma.Decimal(normalized.glam2),
          piso: normalized.piso,
          tipo: normalized.tipo,
          zonaId: zonaRecord?.id ?? null,
          esGLA: normalized.esGLA,
          estado: normalized.estado
        };

        const result = await tx.unit.upsert({
          where: {
            projectId_codigo: {
              projectId: carga.projectId,
              codigo: normalized.codigo
            }
          },
          update: localData,
          create: {
            projectId: carga.projectId,
            codigo: normalized.codigo,
            ...localData
          },
          select: { id: true }
        });

        if (row.status === "NEW") {
          created += 1;
        } else {
          updated += 1;
        }

        void result;
      }
    }, { timeout: 30000 });

    const report: ApplyReport = {
      created,
      updated,
      skipped,
      rejected: rejectedRows.length,
      rejectedRows
    };
    const finalPayload = {
      ...payload,
      report
    };

    await prisma.dataUpload.update({
      where: { id: carga.id },
      data: {
        status: created + updated > 0 ? "OK" : "ERROR",
        recordsLoaded: created + updated,
        errorDetail: JSON.stringify(finalPayload)
      }
    });
    invalidateMetricsCacheByProject(carga.projectId);

    return NextResponse.json({ cargaId: carga.id, report });
  } catch (error) {
    if (processingCargaId) {
      await prisma.dataUpload
        .update({
          where: { id: processingCargaId },
          data: { status: "ERROR" }
        })
        .catch(() => undefined);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "Ya existe un local con ese codigo en este proyecto." },
        { status: 409 }
      );
    }
    return handleApiError(error);
  }
}

