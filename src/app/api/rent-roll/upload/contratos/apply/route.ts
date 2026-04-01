import { Contrato, EstadoContrato, Prisma, TipoCargaDatos, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeUploadRut } from "@/lib/upload/parse-arrendatarios";
import { parseStoredUploadPayload } from "@/lib/upload/payload";
import { parseDate } from "@/lib/upload/parse-utils";
import type { ApplyReport, PreviewRow, UploadIssue } from "@/types/upload";

export const runtime = "nodejs";

type LocalMap = Map<string, string>;
type ArrendatarioMap = Map<string, string>;
type ExistingContratoSnapshot = Prisma.ContratoGetPayload<{ include: { tarifas: true; ggcc: true } }>;

type ContratoApplyRow = {
  rowNumber: number;
  numeroContrato: string;
  localCodigo: string;
  arrendatarioRut: string;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaTermino: string;
  tarifaTipo: TipoTarifaContrato;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctFondoPromocion: string | null;
  codigoCC: string | null;
  notas: string | null;
  ggccTarifaBaseUfM2: string | null;
  ggccPctAdministracion: string | null;
  ggccVigenciaDesde: string | null;
  ggccVigenciaHasta: string | null;
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

type ApplyContratoResult =
  | {
      issue: UploadIssue;
      contrato?: never;
      before?: never;
    }
  | {
      issue?: never;
      contrato: Contrato;
      before: ExistingContratoSnapshot | null;
    };

type StoredContratoPreview = {
  rows: PreviewRow<Record<string, unknown>>[];
  summary: {
    total: number;
    nuevo: number;
    actualizado: number;
    sinCambio: number;
    errores: number;
  };
  warnings: string[];
};

type TarifaApplyInput = Pick<
  ContratoApplyRow,
  "tarifaTipo" | "tarifaValor" | "tarifaVigenciaDesde" | "tarifaVigenciaHasta"
>;
type GgccApplyInput = Pick<
  ContratoApplyRow,
  "ggccTarifaBaseUfM2" | "ggccPctAdministracion" | "ggccVigenciaDesde" | "ggccVigenciaHasta"
>;

const allowedEstadoContrato = new Set(Object.values(EstadoContrato));
const allowedTipoTarifa = new Set(Object.values(TipoTarifaContrato));

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeNullable(value: unknown): string | null {
  const normalized = asString(value);
  return normalized ? normalized : null;
}

function isValidDecimalOrNull(value: string | null): boolean {
  if (!value) {
    return true;
  }
  const normalized = value.replace(",", ".");
  return Number.isFinite(Number(normalized));
}

function decimalOrNull(value: string | null): Prisma.Decimal | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  return new Prisma.Decimal(value.replace(",", "."));
}

function dateOrNull(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = parseDate(value);
  if (!parsed) {
    return null;
  }
  return new Date(parsed);
}

function normalizeContratoRow(rowNumber: number, data: Record<string, unknown>): ContratoApplyRow | null {
  const numeroContrato = asString(data.numeroContrato);
  const localCodigo = asString(data.localCodigo).toUpperCase();
  const arrendatarioRut = normalizeUploadRut(asString(data.arrendatarioRut));
  const estado = asString(data.estado).toUpperCase();
  const fechaInicio = parseDate(data.fechaInicio);
  const fechaTermino = parseDate(data.fechaTermino);
  const tarifaTipo = asString(data.tarifaTipo).toUpperCase();
  const tarifaValor = asString(data.tarifaValor).replace(",", ".");
  const tarifaVigenciaDesde = parseDate(data.tarifaVigenciaDesde);
  const tarifaVigenciaHasta = parseDate(data.tarifaVigenciaHasta);
  const pctFondoPromocion = normalizeNullable(data.pctFondoPromocion);
  const codigoCC = normalizeNullable(data.codigoCC);
  const notas = normalizeNullable(data.notas);
  const ggccTarifaBaseUfM2 = normalizeNullable(data.ggccTarifaBaseUfM2);
  const ggccPctAdministracion = normalizeNullable(data.ggccPctAdministracion);
  const ggccVigenciaDesde = parseDate(data.ggccVigenciaDesde);
  const ggccVigenciaHasta = parseDate(data.ggccVigenciaHasta);
  const anexoFecha = parseDate(data.anexoFecha);
  const anexoDescripcion = normalizeNullable(data.anexoDescripcion);

  if (
    !numeroContrato ||
    !localCodigo ||
    !arrendatarioRut ||
    !fechaInicio ||
    !fechaTermino ||
    !tarifaVigenciaDesde
  ) {
    return null;
  }
  if (!allowedEstadoContrato.has(estado as EstadoContrato)) {
    return null;
  }
  if (!allowedTipoTarifa.has(tarifaTipo as TipoTarifaContrato)) {
    return null;
  }
  if (!tarifaValor || Number.isNaN(Number(tarifaValor))) {
    return null;
  }
  if (!/^\d{7,8}-[\dk]$/.test(arrendatarioRut)) {
    return null;
  }
  if (!isValidDecimalOrNull(pctFondoPromocion)) {
    return null;
  }
  if (!isValidDecimalOrNull(ggccTarifaBaseUfM2) || !isValidDecimalOrNull(ggccPctAdministracion)) {
    return null;
  }
  const hasAnyGgccValue = Boolean(ggccTarifaBaseUfM2 || ggccPctAdministracion || ggccVigenciaDesde);
  const hasCompleteGgcc = Boolean(ggccTarifaBaseUfM2 && ggccPctAdministracion && ggccVigenciaDesde);
  if (hasAnyGgccValue && !hasCompleteGgcc) {
    return null;
  }
  if ((anexoFecha && !anexoDescripcion) || (!anexoFecha && anexoDescripcion)) {
    return null;
  }
  if (new Date(fechaInicio) > new Date(fechaTermino)) {
    return null;
  }

  return {
    rowNumber,
    numeroContrato,
    localCodigo,
    arrendatarioRut,
    estado: estado as EstadoContrato,
    fechaInicio,
    fechaTermino,
    tarifaTipo: tarifaTipo as TipoTarifaContrato,
    tarifaValor,
    tarifaVigenciaDesde,
    tarifaVigenciaHasta,
    pctFondoPromocion,
    codigoCC,
    notas,
    ggccTarifaBaseUfM2,
    ggccPctAdministracion,
    ggccVigenciaDesde,
    ggccVigenciaHasta,
    anexoFecha,
    anexoDescripcion
  };
}

async function applyContrato(
  tx: Prisma.TransactionClient,
  row: ContratoApplyRow,
  proyectoId: string,
  localMap: LocalMap,
  arrendatarioMap: ArrendatarioMap
): Promise<ApplyContratoResult> {
  const localId = localMap.get(row.localCodigo.toUpperCase());
  const arrendatarioId = arrendatarioMap.get(row.arrendatarioRut.toLowerCase());

  if (!localId || !arrendatarioId) {
    return {
      issue: {
        rowNumber: row.rowNumber,
        message: "No existe localCodigo o arrendatarioRut en el proyecto seleccionado."
      }
    };
  }

  const before = await tx.contrato.findUnique({
    where: {
      proyectoId_numeroContrato: {
        proyectoId,
        numeroContrato: row.numeroContrato
      }
    },
    include: { tarifas: true, ggcc: true }
  });

  const contrato = await tx.contrato.upsert({
    where: {
      proyectoId_numeroContrato: {
        proyectoId,
        numeroContrato: row.numeroContrato
      }
    },
    create: {
      proyectoId,
      localId,
      arrendatarioId,
      numeroContrato: row.numeroContrato,
      fechaInicio: new Date(row.fechaInicio),
      fechaTermino: new Date(row.fechaTermino),
      estado: row.estado,
      pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
      codigoCC: row.codigoCC,
      notas: row.notas
    },
    update: {
      localId,
      arrendatarioId,
      fechaInicio: new Date(row.fechaInicio),
      fechaTermino: new Date(row.fechaTermino),
      estado: row.estado,
      pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
      codigoCC: row.codigoCC,
      notas: row.notas
    }
  });

  return { before, contrato };
}

async function applyTarifas(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tarifas: TarifaApplyInput
): Promise<void> {
  const existingTarifa = await tx.contratoTarifa.findFirst({
    where: {
      contratoId,
      tipo: tarifas.tarifaTipo,
      vigenciaDesde: new Date(tarifas.tarifaVigenciaDesde)
    }
  });

  if (existingTarifa) {
    await tx.contratoTarifa.update({
      where: { id: existingTarifa.id },
      data: {
        valor: new Prisma.Decimal(tarifas.tarifaValor),
        vigenciaHasta: dateOrNull(tarifas.tarifaVigenciaHasta)
      }
    });
    return;
  }

  await tx.contratoTarifa.create({
    data: {
      contratoId,
      tipo: tarifas.tarifaTipo,
      valor: new Prisma.Decimal(tarifas.tarifaValor),
      vigenciaDesde: new Date(tarifas.tarifaVigenciaDesde),
      vigenciaHasta: dateOrNull(tarifas.tarifaVigenciaHasta),
      esDiciembre: false
    }
  });
}

async function applyGGCC(
  tx: Prisma.TransactionClient,
  contratoId: string,
  ggcc: GgccApplyInput
): Promise<void> {
  if (!ggcc.ggccTarifaBaseUfM2 || !ggcc.ggccPctAdministracion || !ggcc.ggccVigenciaDesde) {
    return;
  }

  const ggccExists = await tx.contratoGGCC.findFirst({
    where: {
      contratoId,
      vigenciaDesde: new Date(ggcc.ggccVigenciaDesde)
    }
  });
  if (ggccExists) {
    await tx.contratoGGCC.update({
      where: { id: ggccExists.id },
      data: {
        tarifaBaseUfM2: new Prisma.Decimal(ggcc.ggccTarifaBaseUfM2),
        pctAdministracion: new Prisma.Decimal(ggcc.ggccPctAdministracion),
        vigenciaHasta: dateOrNull(ggcc.ggccVigenciaHasta)
      }
    });
    return;
  }

  await tx.contratoGGCC.create({
    data: {
      contratoId,
      tarifaBaseUfM2: new Prisma.Decimal(ggcc.ggccTarifaBaseUfM2),
      pctAdministracion: new Prisma.Decimal(ggcc.ggccPctAdministracion),
      vigenciaDesde: new Date(ggcc.ggccVigenciaDesde),
      vigenciaHasta: dateOrNull(ggcc.ggccVigenciaHasta)
    }
  });
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

    const carga = await prisma.cargaDatos.findUnique({ where: { id: cargaId } });
    if (!carga || carga.tipo !== TipoCargaDatos.RENT_ROLL || !carga.errorDetalle) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }
    if (carga.estado === "PROCESANDO") {
      return NextResponse.json({ message: "La carga ya esta siendo procesada." }, { status: 409 });
    }

    const modernPayload = parseStoredUploadPayload(carga.errorDetalle);
    const payload: StoredContratoPreview | null = modernPayload
      ? modernPayload
      : (() => {
          const legacyPayload = parseRentRollPreviewPayload(carga.errorDetalle);
          if (!legacyPayload) {
            return null;
          }
          const modernRows: PreviewRow<Record<string, unknown>>[] = [
            ...legacyPayload.rows.map((row) => ({
              rowNumber: row.rowNumber,
              status: "UPDATED" as const,
              data: row as unknown as Record<string, unknown>
            })),
            ...legacyPayload.errors.map((issue) => ({
              rowNumber: issue.rowNumber,
              status: "ERROR" as const,
              data: {},
              errorMessage: issue.message
            }))
          ];
          return {
            rows: modernRows,
            summary: {
              total: modernRows.length,
              nuevo: 0,
              actualizado: legacyPayload.rows.length,
              sinCambio: 0,
              errores: legacyPayload.errors.length
            },
            warnings: legacyPayload.warnings
          };
        })();

    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el preview para esta carga." }, { status: 422 });
    }

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: { estado: "PROCESANDO", usuarioId: session.user.id }
    });
    processingCargaId = carga.id;

    const [locales, arrendatarios] = await Promise.all([
      prisma.local.findMany({
        where: { proyectoId: carga.proyectoId },
        select: { id: true, codigo: true }
      }),
      prisma.arrendatario.findMany({
        where: { proyectoId: carga.proyectoId },
        select: { id: true, rut: true }
      })
    ]);
    const localesMap = new Map(locales.map((item) => [item.codigo.toUpperCase(), item.id]));
    const arrendatariosMap = new Map(
      arrendatarios.map((item) => [normalizeUploadRut(item.rut), item.id])
    );

    const duplicatedTarifaKey = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows: UploadIssue[] = [];

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

        const normalized = normalizeContratoRow(row.rowNumber, row.data);
        if (!normalized) {
          rejectedRows.push({
            rowNumber: row.rowNumber,
            message: "No se pudo normalizar la fila para aplicar."
          });
          continue;
        }

        const contratoResult = await applyContrato(
          tx,
          normalized,
          carga.proyectoId,
          localesMap,
          arrendatariosMap
        );

        if (contratoResult.issue) {
          rejectedRows.push(contratoResult.issue);
          continue;
        }

        const { before, contrato } = contratoResult;

        if (before) {
          updated += 1;
        } else {
          created += 1;
        }

        const tarifaKey = `${contrato.id}-${normalized.tarifaTipo}-${normalized.tarifaVigenciaDesde}`;
        if (duplicatedTarifaKey.has(tarifaKey)) {
          rejectedRows.push({
            rowNumber: normalized.rowNumber,
            message: "Tarifa duplicada en el archivo para tipo + vigenciaDesde."
          });
          continue;
        }
        duplicatedTarifaKey.add(tarifaKey);

        await applyTarifas(tx, contrato.id, normalized);
        await applyGGCC(tx, contrato.id, normalized);

        if (normalized.anexoFecha && normalized.anexoDescripcion) {
          await tx.contratoAnexo.create({
            data: {
              contratoId: contrato.id,
              fecha: new Date(normalized.anexoFecha),
              descripcion: normalized.anexoDescripcion,
              camposModificados: {
                origen: "CARGA_RENT_ROLL",
                rowNumber: normalized.rowNumber
              },
              snapshotAntes: before ? before : {},
              snapshotDespues: contrato,
              usuarioId: session.user.id
            }
          });
        }
      }
    }, { timeout: 60000, maxWait: 10000 });

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

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: {
        estado: created + updated > 0 ? "OK" : "ERROR",
        registrosCargados: created + updated,
        errorDetalle: JSON.stringify(finalPayload)
      }
    });

    return NextResponse.json({
      cargaId: carga.id,
      report
    });
  } catch (error) {
    if (processingCargaId) {
      await prisma.cargaDatos
        .update({
          where: { id: processingCargaId },
          data: { estado: "ERROR" }
        })
        .catch(() => undefined);
    }
    return handleApiError(error);
  }
}
