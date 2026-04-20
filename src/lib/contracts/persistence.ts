import { Prisma, ContractRateType, ContractDiscountType, ContractStatus } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { MS_PER_DAY } from "@/lib/constants";

export type ContractsPayloadShape = {
  localId: string;
  localIds: string[];
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
    descuentoTipo?: "PORCENTAJE" | "MONTO_UF" | null;
    descuentoValor?: string | null;
    descuentoDesde?: string | null;
    descuentoHasta?: string | null;
  }>;
  rentaVariable: Array<{
    pctRentaVariable: string;
    umbralVentasUf: string;
    pisoMinimoUf?: string | null;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    pctReajuste: string | null;
    proximoReajuste: string | null;
    mesesReajuste?: number | null;
  }>;
  fechaInicio: string;
  fechaTermino: string;
};

export function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
}

export function normalizedLocalIds(payload: { localId: string; localIds: string[] }): string[] {
  const source = payload.localIds.length > 0 ? payload.localIds : [payload.localId];
  return Array.from(new Set(source));
}

export async function generateNumeroContrato(
  prismaClient: Pick<Prisma.TransactionClient, "contract">,
  proyectoId: string
): Promise<string> {
  while (true) {
    const numeroContrato = crypto.randomUUID().slice(0, 8).toUpperCase();
    const existing = await prismaClient.contract.findUnique({
      where: {
        proyectoId_numeroContrato: {
          proyectoId,
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

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function tarifaKey(
  tipo: string,
  vigenciaDesde: Date | string,
  umbralVentasUf?: string | { toString(): string } | null
): string {
  const base = `${tipo}|${toDateOnly(vigenciaDesde)}`;
  if (tipo === "PORCENTAJE" && umbralVentasUf !== undefined && umbralVentasUf !== null) {
    return `${base}|${umbralVentasUf.toString()}`;
  }
  return base;
}

export function payloadTarifas(payload: ContractsPayloadShape): Array<{
  tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
  valor: string;
  umbralVentasUf: string | null;
  pisoMinimoUf: string | null;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  esDiciembre: boolean;
  descuentoTipo: "PORCENTAJE" | "MONTO_UF" | null;
  descuentoValor: string | null;
  descuentoDesde: string | null;
  descuentoHasta: string | null;
}> {
  const merged = [
    ...payload.tarifas.map((item) => ({
      tipo: item.tipo as "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE",
      valor: item.valor,
      umbralVentasUf: null as string | null,
      pisoMinimoUf: null as string | null,
      vigenciaDesde: item.vigenciaDesde,
      vigenciaHasta: item.vigenciaHasta,
      esDiciembre: item.esDiciembre,
      descuentoTipo: item.descuentoTipo ?? null,
      descuentoValor: item.descuentoValor ?? null,
      descuentoDesde: item.descuentoDesde ?? null,
      descuentoHasta: item.descuentoHasta ?? null
    })),
    ...payload.rentaVariable.map((item) => ({
      tipo: ContractRateType.PORCENTAJE,
      valor: item.pctRentaVariable,
      umbralVentasUf: item.umbralVentasUf as string | null,
      pisoMinimoUf: item.pisoMinimoUf ?? null,
      vigenciaDesde: item.vigenciaDesde,
      vigenciaHasta: item.vigenciaHasta,
      esDiciembre: false,
      descuentoTipo: null as "PORCENTAJE" | "MONTO_UF" | null,
      descuentoValor: null as string | null,
      descuentoDesde: null as string | null,
      descuentoHasta: null as string | null
    }))
  ];

  const byKey = new Map<string, (typeof merged)[number]>();
  for (const item of merged) {
    byKey.set(tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf), item);
  }
  return Array.from(byKey.values());
}

export async function persistTarifas(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tarifas: ReturnType<typeof payloadTarifas>
): Promise<void> {
  const existingTarifas = await tx.contractRate.findMany({
    where: { contratoId }
  });
  const existingTarifasByKey = new Map(
    existingTarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf), item])
  );
  const payloadTarifasByKey = new Map(
    tarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf), item] as const)
  );

  const tarifasToDelete = existingTarifas
    .filter((item) => !payloadTarifasByKey.has(tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf)))
    .map((item) => item.id);

  if (tarifasToDelete.length > 0) {
    await tx.contractRate.deleteMany({
      where: { id: { in: tarifasToDelete } }
    });
  }

  const tarifasToUpdate: Array<{ id: string; payloadItem: ReturnType<typeof payloadTarifas>[number] }> = [];
  const tarifasToCreate: Array<ReturnType<typeof payloadTarifas>[number]> = [];
  for (const item of tarifas) {
    const found = existingTarifasByKey.get(tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf));
    if (found) {
      tarifasToUpdate.push({ id: found.id, payloadItem: item });
    } else {
      tarifasToCreate.push(item);
    }
  }

  await Promise.all(
    tarifasToUpdate.map((item) =>
      tx.contractRate.update({
        where: { id: item.id },
        data: {
          valor: new Prisma.Decimal(item.payloadItem.valor),
          umbralVentasUf: item.payloadItem.umbralVentasUf ? new Prisma.Decimal(item.payloadItem.umbralVentasUf) : null,
          pisoMinimoUf: toDecimal(item.payloadItem.pisoMinimoUf),
          vigenciaHasta: toDate(item.payloadItem.vigenciaHasta),
          esDiciembre: item.payloadItem.esDiciembre,
          descuentoTipo: item.payloadItem.descuentoTipo as ContractDiscountType | null,
          descuentoValor: toDecimal(item.payloadItem.descuentoValor),
          descuentoDesde: toDate(item.payloadItem.descuentoDesde),
          descuentoHasta: toDate(item.payloadItem.descuentoHasta)
        }
      })
    )
  );

  if (tarifasToCreate.length > 0) {
    await tx.contractRate.createMany({
      data: tarifasToCreate.map((item) => ({
        contratoId,
        tipo: item.tipo as ContractRateType,
        valor: new Prisma.Decimal(item.valor),
        umbralVentasUf: item.umbralVentasUf ? new Prisma.Decimal(item.umbralVentasUf) : null,
        pisoMinimoUf: toDecimal(item.pisoMinimoUf),
        vigenciaDesde: new Date(item.vigenciaDesde),
        vigenciaHasta: toDate(item.vigenciaHasta),
        esDiciembre: item.esDiciembre,
        descuentoTipo: item.descuentoTipo as ContractDiscountType | null,
        descuentoValor: toDecimal(item.descuentoValor),
        descuentoDesde: toDate(item.descuentoDesde),
        descuentoHasta: toDate(item.descuentoHasta)
      }))
    });
  }
}

export async function persistContratoLocales(
  tx: Prisma.TransactionClient,
  contratoId: string,
  localIds: string[]
): Promise<void> {
  const existing = await tx.contractUnit.findMany({
    where: { contratoId }
  });

  const existingSet = new Set(existing.map((item) => item.localId));
  const payloadSet = new Set(localIds);
  const toDelete = existing.filter((item) => !payloadSet.has(item.localId)).map((item) => item.id);

  if (toDelete.length > 0) {
    await tx.contractUnit.deleteMany({
      where: { id: { in: toDelete } }
    });
  }

  const toCreate = localIds.filter((localId) => !existingSet.has(localId));
  if (toCreate.length > 0) {
    await tx.contractUnit.createMany({
      data: toCreate.map((localId) => ({
        contratoId,
        localId
      })),
      skipDuplicates: true
    });
  }
}

/**
 * Verify that no active/grace contract shares a local with the candidate
 * contract within its effective date range. Throws ApiError(409) on overlap.
 *
 * Effective end date = fechaTermino + diasGracia.
 * Two intervals overlap iff: startA < endB AND startB < endA.
 */
export async function assertNoOverlappingContracts(
  tx: Pick<Prisma.TransactionClient, "contract">,
  params: {
    proyectoId: string;
    localIds: string[];
    fechaInicio: string;
    fechaTermino: string;
    diasGracia: number;
    excludeContractId?: string | null;
  }
): Promise<void> {
  const { proyectoId, localIds, fechaInicio, fechaTermino, diasGracia, excludeContractId } = params;
  if (localIds.length === 0) {
    return;
  }

  const newStart = new Date(fechaInicio);
  const newEnd = new Date(new Date(fechaTermino).getTime() + diasGracia * MS_PER_DAY);

  const candidates = await tx.contract.findMany({
    where: {
      proyectoId,
      ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
      estado: { in: [ContractStatus.VIGENTE, ContractStatus.GRACIA, ContractStatus.NO_INICIADO] },
      OR: [
        { localId: { in: localIds } },
        { locales: { some: { localId: { in: localIds } } } }
      ]
    },
    select: {
      id: true,
      numeroContrato: true,
      localId: true,
      fechaInicio: true,
      fechaTermino: true,
      diasGracia: true,
      local: { select: { codigo: true } },
      locales: {
        select: {
          localId: true,
          local: { select: { codigo: true } }
        }
      }
    }
  });

  for (const candidate of candidates) {
    const candidateEnd = new Date(candidate.fechaTermino.getTime() + candidate.diasGracia * MS_PER_DAY);
    const overlaps = newStart < candidateEnd && candidate.fechaInicio < newEnd;
    if (!overlaps) {
      continue;
    }
    const overlappingLocalCodigo =
      candidate.locales.find((item) => localIds.includes(item.localId))?.local.codigo ??
      (localIds.includes(candidate.localId) ? candidate.local.codigo : null);
    const localLabel = overlappingLocalCodigo ? ` ${overlappingLocalCodigo}` : "";
    throw new ApiError(
      409,
      `El local${localLabel} ya tiene un contrato vigente (${candidate.numeroContrato}) en el rango indicado.`
    );
  }
}

export async function persistGGCC(
  tx: Prisma.TransactionClient,
  contratoId: string,
  ggcc: ContractsPayloadShape["ggcc"],
  fechaInicio: string,
  fechaTermino: string
): Promise<void> {
  await tx.contractCommonExpense.deleteMany({ where: { contratoId } });

  if (ggcc.length > 0) {
    await tx.contractCommonExpense.createMany({
      data: ggcc.map((item) => ({
        contratoId,
        tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
        pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
        pctReajuste: toDecimal(item.pctReajuste),
        vigenciaDesde: new Date(fechaInicio),
        vigenciaHasta: toDate(fechaTermino),
        proximoReajuste: toDate(item.proximoReajuste),
        mesesReajuste: item.mesesReajuste ?? null
      }))
    });
  }
}
