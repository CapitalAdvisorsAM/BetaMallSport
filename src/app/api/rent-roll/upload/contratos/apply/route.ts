export const dynamic = "force-dynamic";

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

type GgccTipoInput = "FIJO_UF_M2" | "FIJO_UF";
type LocalMap = Map<string, { id: string; glam2: string }>;
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
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: TipoTarifaContrato;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctFondoPromocion: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  notas: string | null;
  ggccTipo: GgccTipoInput | null;
  ggccValor: string | null;
  ggccVigenciaDesde: string | null;
  ggccVigenciaHasta: string | null;
  ggccMesesReajuste: number | null;
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
  | "ggccTipo"
  | "ggccValor"
  | "ggccPctAdministracion"
  | "ggccVigenciaDesde"
  | "ggccVigenciaHasta"
  | "ggccMesesReajuste"
>;

const allowedEstadoContrato = new Set(Object.values(EstadoContrato));
const allowedTipoTarifa = new Set(Object.values(TipoTarifaContrato));
const allowedGgccTipo = new Set<GgccTipoInput>(["FIJO_UF_M2", "FIJO_UF"]);

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

function integerOrNull(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return null;
  }
  return numberValue;
}

function normalizeGgccTipo(value: unknown, hasGgccValue: boolean): GgccTipoInput | null {
  const normalized = asString(value).toUpperCase();
  if (!normalized) {
    return hasGgccValue ? "FIJO_UF_M2" : null;
  }
  if (!allowedGgccTipo.has(normalized as GgccTipoInput)) {
    return null;
  }
  return normalized as GgccTipoInput;
}

function hasValidPositiveDecimal(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const numberValue = Number(value.replace(",", "."));
  return Number.isFinite(numberValue) && numberValue > 0;
}

function toStoredGgccTarifaBaseUfM2(ggcc: GgccApplyInput, localGlam2: string): Prisma.Decimal | null {
  const value = decimalOrNull(ggcc.ggccValor);
  if (!value || !ggcc.ggccTipo) {
    return null;
  }
  if (ggcc.ggccTipo === "FIJO_UF_M2") {
    return value;
  }

  if (!hasValidPositiveDecimal(localGlam2)) {
    return null;
  }

  return value.div(new Prisma.Decimal(localGlam2));
}

function normalizeContratoRow(rowNumber: number, data: Record<string, unknown>): ContratoApplyRow | null {
  const numeroContrato = asString(data.numeroContrato);
  const localCodigo = asString(data.localCodigo).toUpperCase();
  const arrendatarioRut = normalizeUploadRut(asString(data.arrendatarioRut));
  const estado = asString(data.estado).toUpperCase();
  const fechaInicio = parseDate(data.fechaInicio);
  const fechaTermino = parseDate(data.fechaTermino);
  const fechaEntrega = parseDate(data.fechaEntrega);
  const fechaApertura = parseDate(data.fechaApertura);
  const tarifaTipo = asString(data.tarifaTipo).toUpperCase();
  const tarifaValor = asString(data.tarifaValor).replace(",", ".");
  const tarifaVigenciaDesde = parseDate(data.tarifaVigenciaDesde);
  const tarifaVigenciaHasta = parseDate(data.tarifaVigenciaHasta);
  const pctFondoPromocion = normalizeNullable(data.pctFondoPromocion);
  const codigoCC = normalizeNullable(data.codigoCC);
  const ggccPctAdministracion = normalizeNullable(data.ggccPctAdministracion);
  const notas = normalizeNullable(data.notas);
  const legacyGgccValue = normalizeNullable(data.ggccTarifaBaseUfM2);
  const ggccValor = normalizeNullable(data.ggccValor) ?? legacyGgccValue;
  const ggccTipoRaw = asString(data.ggccTipo).toUpperCase();
  const ggccTipo = normalizeGgccTipo(data.ggccTipo, Boolean(ggccValor));
  const ggccVigenciaDesde = parseDate(data.ggccVigenciaDesde);
  const ggccVigenciaHasta = parseDate(data.ggccVigenciaHasta);
  const ggccMesesReajusteRaw = normalizeNullable(data.ggccMesesReajuste);
  const ggccMesesReajuste = integerOrNull(ggccMesesReajusteRaw);
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
  if (!isValidDecimalOrNull(ggccValor) || !isValidDecimalOrNull(ggccPctAdministracion)) {
    return null;
  }
  if (ggccMesesReajusteRaw && ggccMesesReajuste === null) {
    return null;
  }
  if (ggccTipoRaw && ggccTipo === null) {
    return null;
  }
  const hasAnyGgccValue = Boolean(
    ggccTipo ||
      ggccValor ||
      ggccPctAdministracion ||
      ggccVigenciaDesde ||
      ggccVigenciaHasta ||
      ggccMesesReajuste !== null
  );
  const hasCompleteGgcc = Boolean(ggccTipo && ggccValor && ggccPctAdministracion && ggccVigenciaDesde);
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
    fechaEntrega,
    fechaApertura,
    tarifaTipo: tarifaTipo as TipoTarifaContrato,
    tarifaValor,
    tarifaVigenciaDesde,
    tarifaVigenciaHasta,
    pctFondoPromocion,
    codigoCC,
    ggccPctAdministracion,
    notas,
    ggccTipo,
    ggccValor,
    ggccVigenciaDesde,
    ggccVigenciaHasta,
    ggccMesesReajuste,
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
  const localData = localMap.get(row.localCodigo.toUpperCase());
  const arrendatarioId = arrendatarioMap.get(row.arrendatarioRut.toLowerCase());

  if (!localData || !arrendatarioId) {
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
      localId: localData.id,
      arrendatarioId,
      numeroContrato: row.numeroContrato,
      fechaInicio: new Date(row.fechaInicio),
      fechaTermino: new Date(row.fechaTermino),
      fechaEntrega: dateOrNull(row.fechaEntrega),
      fechaApertura: dateOrNull(row.fechaApertura),
      estado: row.estado,
      pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
      codigoCC: row.codigoCC,
      notas: row.notas
    },
    update: {
      localId: localData.id,
      arrendatarioId,
      fechaInicio: new Date(row.fechaInicio),
      fechaTermino: new Date(row.fechaTermino),
      fechaEntrega: dateOrNull(row.fechaEntrega),
      fechaApertura: dateOrNull(row.fechaApertura),
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
  ggcc: GgccApplyInput,
  localGlam2: string
): Promise<void> {
  if (!ggcc.ggccTipo || !ggcc.ggccValor || !ggcc.ggccPctAdministracion || !ggcc.ggccVigenciaDesde) {
    return;
  }

  const tarifaBaseUfM2 = toStoredGgccTarifaBaseUfM2(ggcc, localGlam2);
  if (!tarifaBaseUfM2) {
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
        tarifaBaseUfM2,
        pctAdministracion: new Prisma.Decimal(ggcc.ggccPctAdministracion),
        vigenciaHasta: dateOrNull(ggcc.ggccVigenciaHasta),
        mesesReajuste: ggcc.ggccMesesReajuste ?? null
      }
    });
    return;
  }

  await tx.contratoGGCC.create({
    data: {
      contratoId,
      tarifaBaseUfM2,
      pctAdministracion: new Prisma.Decimal(ggcc.ggccPctAdministracion),
      vigenciaDesde: new Date(ggcc.ggccVigenciaDesde),
      vigenciaHasta: dateOrNull(ggcc.ggccVigenciaHasta),
      proximoReajuste: null,
      mesesReajuste: ggcc.ggccMesesReajuste ?? null
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
        select: { id: true, codigo: true, glam2: true }
      }),
      prisma.arrendatario.findMany({
        where: { proyectoId: carga.proyectoId },
        select: { id: true, rut: true }
      })
    ]);
    const localesMap = new Map(
      locales.map((item) => [item.codigo.toUpperCase(), { id: item.id, glam2: item.glam2.toString() }])
    );
    const arrendatariosMap = new Map(
      arrendatarios.map((item) => [normalizeUploadRut(item.rut), item.id])
    );

    const duplicatedTarifaKey = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows: UploadIssue[] = [];

    await prisma.$transaction(
      async (tx) => {
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

          const localData = localesMap.get(normalized.localCodigo.toUpperCase());
          if (normalized.ggccTipo === "FIJO_UF" && !hasValidPositiveDecimal(localData?.glam2 ?? null)) {
            rejectedRows.push({
              rowNumber: normalized.rowNumber,
              message: `El local '${normalized.localCodigo}' no tiene GLA valida para convertir GGCC FIJO_UF a UF/m2.`
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
          if (localData) {
            await applyGGCC(tx, contrato.id, normalized, localData.glam2);
          }

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
      },
      { timeout: 60000, maxWait: 10000 }
    );

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
