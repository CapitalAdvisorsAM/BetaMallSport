import { Contract, ContractStatus, Prisma, ContractRateType } from "@prisma/client";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";
import { normalizeUploadTenantName } from "@/lib/upload/parse-contracts";
import { parseDate } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadIssue } from "@/types/upload";

type GgccTipoInput = "FIJO_UF_M2" | "FIJO_UF";
export type LocalMap = Map<string, { id: string; glam2: string }>;
export type ArrendatarioMap = Map<string, string[]>;
type ExistingContratoSnapshot = Prisma.ContractGetPayload<{ include: { tarifas: true; ggcc: true } }>;

export type ContratoApplyRow = {
  rowNumber: number;
  numeroContrato: string;
  localCodigo: string;
  arrendatarioNombre: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: ContractRateType;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  tarifa2Valor: string | null;
  tarifa2VigenciaDesde: string | null;
  tarifa2VigenciaHasta: string | null;
  tarifa3Valor: string | null;
  tarifa3VigenciaDesde: string | null;
  tarifa3VigenciaHasta: string | null;
  tarifa4Valor: string | null;
  tarifa4VigenciaDesde: string | null;
  tarifa4VigenciaHasta: string | null;
  tarifa5Valor: string | null;
  tarifa5VigenciaDesde: string | null;
  tarifa5VigenciaHasta: string | null;
  rentaVariablePct: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  ggccPctReajuste: string | null;
  notas: string | null;
  ggccTipo: GgccTipoInput | null;
  ggccValor: string | null;
  ggccMesesReajuste: number | null;
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

export type ApplyContratoResult =
  | {
      issue: UploadIssue;
      contrato?: never;
      before?: never;
    }
  | {
      issue?: never;
      contrato: Contract;
      before: ExistingContratoSnapshot | null;
    };

export type StoredContratoPreview = {
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

export type TarifaApplyInput = Pick<
  ContratoApplyRow,
  "tarifaTipo" | "tarifaValor" | "tarifaVigenciaDesde" | "tarifaVigenciaHasta"
>;
type GgccApplyInput = Pick<
  ContratoApplyRow,
  | "ggccTipo"
  | "ggccValor"
  | "ggccPctAdministracion"
  | "ggccPctReajuste"
  | "ggccMesesReajuste"
>;

const allowedTipoTarifa = new Set(Object.values(ContractRateType));
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

export function hasValidPositiveDecimal(value: string | null): boolean {
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

async function generateNumeroContrato(
  tx: Prisma.TransactionClient,
  proyectoId: string
): Promise<string> {
  while (true) {
    const numeroContrato = crypto.randomUUID().slice(0, 8).toUpperCase();
    const existing = await tx.contract.findUnique({
      where: {
        projectId_numeroContrato: {
          projectId: proyectoId,
          numeroContrato
        }
      },
      select: { id: true }
    });

    if (!existing) {
      return numeroContrato;
    }
  }
}

export function normalizeContratoRow(
  rowNumber: number,
  data: Record<string, unknown>
): ContratoApplyRow | null {
  const numeroContrato = asString(data.numeroContrato);
  const localCodigo = asString(data.localCodigo).toUpperCase();
  const arrendatarioNombre = asString(data.arrendatarioNombre);
  const arrendatarioNombreLookup = normalizeUploadTenantName(arrendatarioNombre);
  const fechaInicio = parseDate(data.fechaInicio);
  const fechaTermino = parseDate(data.fechaTermino);
  const fechaEntrega = parseDate(data.fechaEntrega);
  const fechaApertura = parseDate(data.fechaApertura);
  const tarifaTipo = asString(data.tarifaTipo).toUpperCase();
  const tarifaValor = asString(data.tarifaValor).replace(",", ".");
  const tarifaVigenciaDesde = parseDate(data.tarifaVigenciaDesde);
  const tarifaVigenciaHasta = parseDate(data.tarifaVigenciaHasta);
  const tarifa2Valor = normalizeNullable(data.tarifa2Valor)?.replace(",", ".") ?? null;
  const tarifa2VigenciaDesde = parseDate(data.tarifa2VigenciaDesde);
  const tarifa2VigenciaHasta = parseDate(data.tarifa2VigenciaHasta);
  const tarifa3Valor = normalizeNullable(data.tarifa3Valor)?.replace(",", ".") ?? null;
  const tarifa3VigenciaDesde = parseDate(data.tarifa3VigenciaDesde);
  const tarifa3VigenciaHasta = parseDate(data.tarifa3VigenciaHasta);
  const tarifa4Valor = normalizeNullable(data.tarifa4Valor)?.replace(",", ".") ?? null;
  const tarifa4VigenciaDesde = parseDate(data.tarifa4VigenciaDesde);
  const tarifa4VigenciaHasta = parseDate(data.tarifa4VigenciaHasta);
  const tarifa5Valor = normalizeNullable(data.tarifa5Valor)?.replace(",", ".") ?? null;
  const tarifa5VigenciaDesde = parseDate(data.tarifa5VigenciaDesde);
  const tarifa5VigenciaHasta = parseDate(data.tarifa5VigenciaHasta);
  const rentaVariablePct = normalizeNullable(data.rentaVariablePct)?.replace(",", ".") ?? null;
  const pctFondoPromocion = normalizeNullable(data.pctFondoPromocion);
  const multiplicadorDiciembre = normalizeNullable(data.multiplicadorDiciembre);
  const multiplicadorJunio = normalizeNullable(data.multiplicadorJunio);
  const multiplicadorJulio = normalizeNullable(data.multiplicadorJulio);
  const multiplicadorAgosto = normalizeNullable(data.multiplicadorAgosto);
  const codigoCC = normalizeNullable(data.codigoCC);
  const ggccPctAdministracion = normalizeNullable(data.ggccPctAdministracion);
  const ggccPctReajuste = normalizeNullable(data.ggccPctReajuste);
  const notas = normalizeNullable(data.notas);
  const legacyGgccValue = normalizeNullable(data.ggccTarifaBaseUfM2);
  const ggccValor = normalizeNullable(data.ggccValor) ?? legacyGgccValue;
  const ggccTipoRaw = asString(data.ggccTipo).toUpperCase();
  const ggccTipo = normalizeGgccTipo(data.ggccTipo, Boolean(ggccValor));
  const ggccMesesReajusteRaw = normalizeNullable(data.ggccMesesReajuste);
  const ggccMesesReajuste = integerOrNull(ggccMesesReajusteRaw);
  const anexoFecha = parseDate(data.anexoFecha);
  const anexoDescripcion = normalizeNullable(data.anexoDescripcion);
  const tarifaTipoFinal = tarifaTipo as ContractRateType;
  const tarifaUsaFechasContrato = tarifaTipoFinal === ContractRateType.PORCENTAJE;
  const tarifaVigenciaDesdeFinal = tarifaUsaFechasContrato ? fechaInicio : tarifaVigenciaDesde;
  const tarifaVigenciaHastaFinal = tarifaUsaFechasContrato ? fechaTermino : tarifaVigenciaHasta;

  if (
    !localCodigo ||
    !arrendatarioNombreLookup ||
    !fechaInicio ||
    !fechaTermino ||
    !tarifaVigenciaDesdeFinal
  ) {
    return null;
  }
  if (!allowedTipoTarifa.has(tarifaTipo as ContractRateType)) {
    return null;
  }
  if (!tarifaValor || Number.isNaN(Number(tarifaValor))) {
    return null;
  }
  if (!isValidDecimalOrNull(pctFondoPromocion)) {
    return null;
  }
  if (!isValidDecimalOrNull(multiplicadorDiciembre)) {
    return null;
  }
  if (!isValidDecimalOrNull(multiplicadorJunio)) {
    return null;
  }
  if (!isValidDecimalOrNull(multiplicadorJulio)) {
    return null;
  }
  if (!isValidDecimalOrNull(multiplicadorAgosto)) {
    return null;
  }
  if (
    !isValidDecimalOrNull(ggccValor) ||
    !isValidDecimalOrNull(ggccPctAdministracion) ||
    !isValidDecimalOrNull(ggccPctReajuste)
  ) {
    return null;
  }
  if (ggccMesesReajusteRaw && ggccMesesReajuste === null) {
    return null;
  }
  if (ggccMesesReajuste !== null && !ggccPctReajuste) {
    return null;
  }
  if (ggccTipoRaw && ggccTipo === null) {
    return null;
  }
  const hasAnyGgccValue = Boolean(
    ggccTipo ||
      ggccValor ||
      ggccPctAdministracion ||
      ggccPctReajuste ||
      ggccMesesReajuste !== null
  );
  const hasCompleteGgcc = Boolean(ggccTipo && ggccValor && ggccPctAdministracion);
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
    arrendatarioNombre,
    fechaInicio,
    fechaTermino,
    fechaEntrega,
    fechaApertura,
    tarifaTipo: tarifaTipoFinal,
    tarifaValor,
    tarifaVigenciaDesde: tarifaVigenciaDesdeFinal,
    tarifaVigenciaHasta: tarifaVigenciaHastaFinal,
    tarifa2Valor,
    tarifa2VigenciaDesde,
    tarifa2VigenciaHasta,
    tarifa3Valor,
    tarifa3VigenciaDesde,
    tarifa3VigenciaHasta,
    tarifa4Valor,
    tarifa4VigenciaDesde,
    tarifa4VigenciaHasta,
    tarifa5Valor,
    tarifa5VigenciaDesde,
    tarifa5VigenciaHasta,
    rentaVariablePct,
    pctFondoPromocion,
    multiplicadorDiciembre,
    multiplicadorJunio,
    multiplicadorJulio,
    multiplicadorAgosto,
    codigoCC,
    ggccPctAdministracion,
    ggccPctReajuste,
    notas,
    ggccTipo,
    ggccValor,
    ggccMesesReajuste,
    anexoFecha,
    anexoDescripcion
  };
}

export async function applyContrato(
  tx: Prisma.TransactionClient,
  row: ContratoApplyRow,
  proyectoId: string,
  localMap: LocalMap,
  arrendatarioMap: ArrendatarioMap
): Promise<ApplyContratoResult> {
  const localData = localMap.get(row.localCodigo.toUpperCase());
  const arrendatarioMatches = arrendatarioMap.get(
    normalizeUploadTenantName(row.arrendatarioNombre)
  );
  const arrendatarioId = arrendatarioMatches?.length === 1 ? arrendatarioMatches[0] : null;

  if (!localData || !arrendatarioMatches || arrendatarioMatches.length === 0) {
    return {
      issue: {
        rowNumber: row.rowNumber,
        message: "No existe localCodigo o arrendatarioNombre en el proyecto seleccionado."
      }
    };
  }
  if (!arrendatarioId) {
    return {
      issue: {
        rowNumber: row.rowNumber,
        message: `Arrendatario '${row.arrendatarioNombre}' es ambiguo. Debe ser unico en el proyecto.`
      }
    };
  }

  const beforeByNatural = await tx.contract.findFirst({
    where: {
      projectId: proyectoId,
      localId: localData.id,
      arrendatarioId,
      fechaInicio: new Date(row.fechaInicio),
      fechaTermino: new Date(row.fechaTermino)
    },
    include: { tarifas: { where: { supersededAt: null } }, ggcc: true }
  });
  const beforeByNumero =
    !beforeByNatural && row.numeroContrato
      ? await tx.contract.findUnique({
          where: {
            projectId_numeroContrato: {
              projectId: proyectoId,
              numeroContrato: row.numeroContrato
            }
          },
          include: { tarifas: { where: { supersededAt: null } }, ggcc: true }
        })
      : null;
  const before = beforeByNatural ?? beforeByNumero;

  const numeroContrato =
    before?.numeroContrato || row.numeroContrato || (await generateNumeroContrato(tx, proyectoId));

  const contrato = before
    ? await tx.contract.update({
        where: { id: before.id },
        data: {
          localId: localData.id,
          arrendatarioId,
          fechaInicio: new Date(row.fechaInicio),
          fechaTermino: new Date(row.fechaTermino),
          fechaEntrega: dateOrNull(row.fechaEntrega),
          fechaApertura: dateOrNull(row.fechaApertura),
          estado: computeEstadoContrato(
            new Date(row.fechaInicio),
            new Date(row.fechaTermino),
            0,
            ContractStatus.VIGENTE,
            startOfDay(new Date())
          ),
          pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
          multiplicadorDiciembre: decimalOrNull(row.multiplicadorDiciembre),
          multiplicadorJunio: decimalOrNull(row.multiplicadorJunio),
          multiplicadorJulio: decimalOrNull(row.multiplicadorJulio),
          multiplicadorAgosto: decimalOrNull(row.multiplicadorAgosto),
          codigoCC: row.codigoCC,
          notas: row.notas
        }
      })
    : await tx.contract.create({
        data: {
          projectId: proyectoId,
          localId: localData.id,
          arrendatarioId,
          numeroContrato,
          fechaInicio: new Date(row.fechaInicio),
          fechaTermino: new Date(row.fechaTermino),
          fechaEntrega: dateOrNull(row.fechaEntrega),
          fechaApertura: dateOrNull(row.fechaApertura),
          estado: computeEstadoContrato(
            new Date(row.fechaInicio),
            new Date(row.fechaTermino),
            0,
            ContractStatus.VIGENTE,
            startOfDay(new Date())
          ),
          pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
          multiplicadorDiciembre: decimalOrNull(row.multiplicadorDiciembre),
          multiplicadorJunio: decimalOrNull(row.multiplicadorJunio),
          multiplicadorJulio: decimalOrNull(row.multiplicadorJulio),
          multiplicadorAgosto: decimalOrNull(row.multiplicadorAgosto),
          codigoCC: row.codigoCC,
          notas: row.notas
        }
      });

  return { before, contrato };
}

export type ApplyOptions = {
  /** UUID of the user driving the upload — used for supersededBy on retired rows. */
  userId: string;
  /** Override timestamp (for testability). */
  now?: Date;
};

/**
 * Upserts a single tarifa from a rent-roll upload row, with bitemporal supersession.
 *
 * Differences from persistTarifas (the editor's API):
 *   - Operates on ONE tarifa at a time (the upload provides them piecemeal).
 *   - Active rows that don't appear in this call are LEFT ALONE (incremental merge,
 *     not "replace-set"). The upload doesn't know the complete picture.
 *
 * Behavior:
 *   - Active row with same (tipo, vigenciaDesde) and same values → no-op.
 *   - Active row with same (tipo, vigenciaDesde) but different valor/vigenciaHasta
 *     → supersede + insert new (preserves history; required since the GIST constraint
 *     would block an in-place UPDATE that conflicts with a different active row).
 *   - No active row with that key → simple insert.
 */
export async function applyTarifas(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tarifas: TarifaApplyInput,
  options: ApplyOptions
): Promise<void> {
  const now = options.now ?? new Date();
  const newValor = new Prisma.Decimal(tarifas.tarifaValor);
  const newHasta = dateOrNull(tarifas.tarifaVigenciaHasta);

  const existing = await tx.contractRate.findFirst({
    where: {
      contratoId,
      supersededAt: null,
      tipo: tarifas.tarifaTipo,
      vigenciaDesde: new Date(tarifas.tarifaVigenciaDesde)
    }
  });

  if (existing) {
    const sameValor = existing.valor.equals(newValor);
    const sameHasta =
      (existing.vigenciaHasta === null && newHasta === null) ||
      (existing.vigenciaHasta !== null && newHasta !== null &&
        existing.vigenciaHasta.toISOString().slice(0, 10) === newHasta.toISOString().slice(0, 10));
    if (sameValor && sameHasta) {
      return;
    }
    await tx.contractRate.update({
      where: { id: existing.id },
      data: {
        supersededAt: now,
        supersededBy: options.userId,
        supersedeReason: "rent-roll upload"
      }
    });
  }

  await tx.contractRate.create({
    data: {
      contratoId,
      tipo: tarifas.tarifaTipo,
      valor: newValor,
      vigenciaDesde: new Date(tarifas.tarifaVigenciaDesde),
      vigenciaHasta: newHasta,
      esDiciembre: false
    }
  });
}

/**
 * Upserts the GGCC profile of a contract from an upload row, with supersession.
 *
 * Atomic-set semantics (mirrors persistGGCC): if any active row's values differ
 * from the payload, ALL active rows are superseded and ONE new row is inserted.
 * If the active set already matches the payload → no-op.
 */
export async function applyGGCC(
  tx: Prisma.TransactionClient,
  contratoId: string,
  ggcc: GgccApplyInput,
  localGlam2: string,
  fechaInicio: string,
  fechaTermino: string,
  options: ApplyOptions
): Promise<void> {
  if (!ggcc.ggccTipo || !ggcc.ggccValor || !ggcc.ggccPctAdministracion) {
    return;
  }

  const tarifaBaseUfM2 = toStoredGgccTarifaBaseUfM2(ggcc, localGlam2);
  if (!tarifaBaseUfM2) {
    return;
  }

  const now = options.now ?? new Date();
  const newPctAdmin = new Prisma.Decimal(ggcc.ggccPctAdministracion);
  const newPctReajuste = decimalOrNull(ggcc.ggccPctReajuste);
  const newVigenciaDesde = new Date(fechaInicio);
  const newVigenciaHasta = dateOrNull(fechaTermino);
  const newMesesReajuste = ggcc.ggccMesesReajuste ?? null;

  const existing = await tx.contractCommonExpense.findMany({
    where: { contratoId, supersededAt: null }
  });

  if (existing.length === 1) {
    const row = existing[0];
    const dateEq = (a: Date | null, b: Date | null) =>
      (a === null && b === null) ||
      (a !== null && b !== null && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10));
    const decEq = (a: Prisma.Decimal | null, b: Prisma.Decimal | null) =>
      (a === null && b === null) || (a !== null && b !== null && a.equals(b));

    const matches =
      row.tarifaBaseUfM2.equals(tarifaBaseUfM2) &&
      row.pctAdministracion.equals(newPctAdmin) &&
      decEq(row.pctReajuste, newPctReajuste) &&
      dateEq(row.vigenciaDesde, newVigenciaDesde) &&
      dateEq(row.vigenciaHasta, newVigenciaHasta) &&
      (row.mesesReajuste ?? null) === newMesesReajuste;
    if (matches) {
      return;
    }
  }

  if (existing.length > 0) {
    await tx.contractCommonExpense.updateMany({
      where: { id: { in: existing.map((r) => r.id) } },
      data: {
        supersededAt: now,
        supersededBy: options.userId,
        supersedeReason: "rent-roll upload"
      }
    });
  }

  await tx.contractCommonExpense.create({
    data: {
      contratoId,
      tarifaBaseUfM2,
      pctAdministracion: newPctAdmin,
      pctReajuste: newPctReajuste,
      vigenciaDesde: newVigenciaDesde,
      vigenciaHasta: newVigenciaHasta,
      proximoReajuste: null,
      mesesReajuste: newMesesReajuste
    }
  });
}
