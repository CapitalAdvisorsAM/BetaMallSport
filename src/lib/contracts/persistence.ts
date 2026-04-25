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

export type PersistTarifasOptions = {
  /** UUID of the user making the change — recorded as supersededBy on retired rows. */
  userId: string;
  /** Optional ContractAmendment id to link with this change (option C: hybrid capture). */
  amendmentId: string | null;
  /** Human-readable reason (typically the anexo description). */
  supersedeReason?: string | null;
  /** Override the supersession timestamp (for testability). */
  now?: Date;
};

type ExistingActiveRate = {
  id: string;
  tipo: ContractRateType;
  valor: Prisma.Decimal;
  umbralVentasUf: Prisma.Decimal | null;
  pisoMinimoUf: Prisma.Decimal | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  esDiciembre: boolean;
};

type ExistingActiveDiscount = {
  id: string;
  tipo: ContractDiscountType;
  valor: Prisma.Decimal;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
};

type ExistingActiveRateWithDiscounts = ExistingActiveRate & {
  discounts: ExistingActiveDiscount[];
};

type PayloadTarifa = ReturnType<typeof payloadTarifas>[number];

/**
 * Implicit discount derived from the legacy embedded fields on a payload tarifa.
 * The form still ships discount info as four fields per tarifa (descuentoTipo/Valor/
 * Desde/Hasta); persistTarifas translates that to ContractRateDiscount rows. When the
 * form is rebuilt to support multiple discounts per rate, this function will be
 * replaced by direct iteration over a `tarifa.discounts` array.
 */
type ImplicitDiscount = {
  tipo: ContractDiscountType;
  valor: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
};

function decimalEquals(a: Prisma.Decimal | null, b: string | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  try {
    return a.equals(new Prisma.Decimal(b));
  } catch {
    return false;
  }
}

function dateEquals(a: Date | null, b: string | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

/**
 * Compares ONLY the rate-level fields (no discount fields). Discounts now live in
 * ContractRateDiscount and are versioned independently — a discount-only change must
 * not supersede the parent rate.
 */
export function tarifaRateOnlyEqual(existing: ExistingActiveRate, payload: PayloadTarifa): boolean {
  return (
    decimalEquals(existing.valor, payload.valor) &&
    decimalEquals(existing.umbralVentasUf, payload.umbralVentasUf) &&
    decimalEquals(existing.pisoMinimoUf, payload.pisoMinimoUf) &&
    dateEquals(existing.vigenciaHasta, payload.vigenciaHasta) &&
    existing.esDiciembre === payload.esDiciembre
  );
}

/**
 * Extracts the discount embedded in a payload tarifa. Returns null when the payload
 * has no active discount. The form may set descuentoDesde/Hasta to null — in that
 * case the discount is treated as covering the parent rate's full validity window.
 */
export function legacyDiscountFromPayload(payload: PayloadTarifa): ImplicitDiscount | null {
  if (!payload.descuentoTipo || !payload.descuentoValor) return null;
  return {
    tipo: payload.descuentoTipo as ContractDiscountType,
    valor: payload.descuentoValor,
    vigenciaDesde: payload.descuentoDesde ?? payload.vigenciaDesde,
    vigenciaHasta: payload.descuentoHasta ?? payload.vigenciaHasta
  };
}

function discountEqual(existing: ExistingActiveDiscount, payload: ImplicitDiscount): boolean {
  return (
    existing.tipo === payload.tipo &&
    decimalEquals(existing.valor, payload.valor) &&
    dateEquals(existing.vigenciaDesde, payload.vigenciaDesde) &&
    dateEquals(existing.vigenciaHasta, payload.vigenciaHasta)
  );
}

/**
 * @deprecated Use tarifaRateOnlyEqual + per-discount comparison instead. This combined
 * helper conflated rate-level and discount-level changes; kept exported only because
 * older callers may still reference it. Will be removed in a follow-up.
 */
export function tarifaValuesEqual(existing: ExistingActiveRate, payload: PayloadTarifa): boolean {
  return tarifaRateOnlyEqual(existing, payload);
}

/**
 * Persists tarifas using bitemporal supersession.
 *
 *   - Existing active rows whose payload twin has identical values  → no-op.
 *   - Existing active rows whose payload twin has changed values    → mark superseded + insert new.
 *   - Existing active rows absent from payload                       → mark superseded (logical delete).
 *   - Payload items without an existing match                        → simple insert.
 *
 * The match key is `(tipo, vigenciaDesde, umbralVentasUf)`. Changing any of those keys
 * is interpreted as "retire and replace", not as in-place edit.
 *
 * Superseded rows are preserved forever — they are how we reconstruct historical reports
 * (`ContractAmendment.snapshotAntes` JSON is also preserved for legal traceability when
 * `amendmentId` is provided).
 */
export async function persistTarifas(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tarifas: ReturnType<typeof payloadTarifas>,
  options: PersistTarifasOptions
): Promise<void> {
  const now = options.now ?? new Date();

  // Load currently-active rates AND their currently-active discounts. Superseded
  // rows are historical and never touched.
  const existing = await tx.contractRate.findMany({
    where: { contratoId, supersededAt: null },
    include: { discounts: { where: { supersededAt: null } } }
  });

  const existingByKey = new Map<string, ExistingActiveRateWithDiscounts>(
    existing.map((row) => [tarifaKey(row.tipo, row.vigenciaDesde, row.umbralVentasUf), row])
  );
  const payloadByKey = new Map(
    tarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde, item.umbralVentasUf), item])
  );

  // Aggregated mutations applied at the end so we can use Prisma's set-based ops.
  const rateIdsToSupersede: string[] = [];
  const discountIdsToSupersede: string[] = [];
  const ratesToInsert: PayloadTarifa[] = [];
  // Discounts to insert that target an EXISTING (kept) rate. Discounts targeting
  // a NEW rate are derived later, after the new rates' UUIDs are generated.
  const discountsToInsertOnExistingRate: Array<{
    contractRateId: string;
    discount: ImplicitDiscount;
  }> = [];

  for (const [key, row] of existingByKey) {
    const payloadItem = payloadByKey.get(key);

    if (payloadItem === undefined) {
      // Row removed from payload → supersede rate AND its active discounts together.
      rateIdsToSupersede.push(row.id);
      for (const d of row.discounts) discountIdsToSupersede.push(d.id);
      continue;
    }

    const newDiscount = legacyDiscountFromPayload(payloadItem);

    if (!tarifaRateOnlyEqual(row, payloadItem)) {
      // Rate-level fields changed → supersede rate + its discounts; queue new rate.
      // Any discount in the payload will be re-attached to the new rate after insert.
      rateIdsToSupersede.push(row.id);
      for (const d of row.discounts) discountIdsToSupersede.push(d.id);
      ratesToInsert.push(payloadItem);
      continue;
    }

    // Rate-level fields unchanged — check the discount independently. The form ships
    // at most one discount per rate today, so the existing-vs-payload comparison is
    // a 1:1 match on the (single) active discount. Multi-discount support per rate
    // requires reshaping the payload; tracked as a follow-up.
    const existingDiscount = row.discounts[0] ?? null;
    const noChange =
      (existingDiscount === null && newDiscount === null) ||
      (existingDiscount !== null &&
        newDiscount !== null &&
        discountEqual(existingDiscount, newDiscount));
    if (noChange) continue;

    if (existingDiscount) discountIdsToSupersede.push(existingDiscount.id);
    if (newDiscount) {
      discountsToInsertOnExistingRate.push({
        contractRateId: row.id,
        discount: newDiscount
      });
    }
  }

  // Payload rows not matching any existing key → fresh insert (rate + optional discount).
  for (const [key, item] of payloadByKey) {
    if (!existingByKey.has(key)) {
      ratesToInsert.push(item);
    }
  }

  // Phase 1: supersession (rates + discounts) — run BEFORE inserts so that the GIST
  // anti-overlap constraint sees the old rows as already superseded by the time the
  // replacement rows hit the same date range.
  const supersedeMeta = {
    supersededAt: now,
    supersededBy: options.userId,
    supersedeReason: options.supersedeReason ?? null,
    amendmentId: options.amendmentId
  } as const;

  if (rateIdsToSupersede.length > 0) {
    await tx.contractRate.updateMany({
      where: { id: { in: rateIdsToSupersede } },
      data: supersedeMeta
    });
  }

  if (discountIdsToSupersede.length > 0) {
    await tx.contractRateDiscount.updateMany({
      where: { id: { in: discountIdsToSupersede } },
      data: supersedeMeta
    });
  }

  // Phase 2: insert new rates with pre-generated UUIDs so their discounts can be
  // linked in the same call without a round-trip. Legacy descuento* columns are
  // intentionally NOT written; discounts live exclusively in ContractRateDiscount.
  const newRatesWithIds = ratesToInsert.map((item) => ({ id: crypto.randomUUID(), item }));
  if (newRatesWithIds.length > 0) {
    await tx.contractRate.createMany({
      data: newRatesWithIds.map(({ id, item }) => ({
        id,
        contratoId,
        tipo: item.tipo as ContractRateType,
        valor: new Prisma.Decimal(item.valor),
        umbralVentasUf: item.umbralVentasUf ? new Prisma.Decimal(item.umbralVentasUf) : null,
        pisoMinimoUf: toDecimal(item.pisoMinimoUf),
        vigenciaDesde: new Date(item.vigenciaDesde),
        vigenciaHasta: toDate(item.vigenciaHasta),
        esDiciembre: item.esDiciembre,
        amendmentId: options.amendmentId
      }))
    });
  }

  // Phase 3: insert discounts. Combines (a) discounts attached to NEW rates and
  // (b) discount-only changes that target EXISTING rates whose value didn't change.
  const allDiscountInserts: Array<{ contractRateId: string; discount: ImplicitDiscount }> = [
    ...discountsToInsertOnExistingRate
  ];
  for (const { id, item } of newRatesWithIds) {
    const d = legacyDiscountFromPayload(item);
    if (d) allDiscountInserts.push({ contractRateId: id, discount: d });
  }

  if (allDiscountInserts.length > 0) {
    await tx.contractRateDiscount.createMany({
      data: allDiscountInserts.map(({ contractRateId, discount }) => ({
        contractRateId,
        tipo: discount.tipo,
        valor: new Prisma.Decimal(discount.valor),
        vigenciaDesde: new Date(discount.vigenciaDesde),
        vigenciaHasta: discount.vigenciaHasta ? new Date(discount.vigenciaHasta) : null,
        amendmentId: options.amendmentId
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
    projectId: string;
    localIds: string[];
    fechaInicio: string;
    fechaTermino: string;
    diasGracia: number;
    excludeContractId?: string | null;
  }
): Promise<void> {
  const { projectId, localIds, fechaInicio, fechaTermino, diasGracia, excludeContractId } = params;
  const proyectoId = projectId;
  if (localIds.length === 0) {
    return;
  }

  const newStart = new Date(fechaInicio);
  const newEnd = new Date(new Date(fechaTermino).getTime() + diasGracia * MS_PER_DAY);

  const candidates = await tx.contract.findMany({
    where: {
      projectId: proyectoId,
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

export type PersistGGCCOptions = {
  /** UUID of the user making the change — recorded as supersededBy on retired rows. */
  userId: string;
  /** Optional ContractAmendment id to link with this change (option C). */
  amendmentId: string | null;
  /** Human-readable reason (typically the anexo description). */
  supersedeReason?: string | null;
  /** Override the supersession timestamp (for testability). */
  now?: Date;
};

type ExistingActiveGGCC = {
  id: string;
  tarifaBaseUfM2: Prisma.Decimal;
  pctAdministracion: Prisma.Decimal;
  pctReajuste: Prisma.Decimal | null;
  proximoReajuste: Date | null;
  mesesReajuste: number | null;
};

type PayloadGGCC = ContractsPayloadShape["ggcc"][number];

function ggccCanonicalKey(
  row: ExistingActiveGGCC | PayloadGGCC
): string {
  const tarifa = row.tarifaBaseUfM2 instanceof Prisma.Decimal
    ? row.tarifaBaseUfM2.toString()
    : new Prisma.Decimal(row.tarifaBaseUfM2).toString();
  const pctAdm = row.pctAdministracion instanceof Prisma.Decimal
    ? row.pctAdministracion.toString()
    : new Prisma.Decimal(row.pctAdministracion).toString();
  const pctRea = row.pctReajuste === null || row.pctReajuste === undefined
    ? ""
    : row.pctReajuste instanceof Prisma.Decimal
      ? row.pctReajuste.toString()
      : new Prisma.Decimal(row.pctReajuste).toString();
  const prox = row.proximoReajuste === null || row.proximoReajuste === undefined
    ? ""
    : row.proximoReajuste instanceof Date
      ? row.proximoReajuste.toISOString().slice(0, 10)
      : new Date(row.proximoReajuste).toISOString().slice(0, 10);
  const meses = row.mesesReajuste === null || row.mesesReajuste === undefined ? "" : String(row.mesesReajuste);
  return `${tarifa}|${pctAdm}|${pctRea}|${prox}|${meses}`;
}

/**
 * Persists GGCC rows using bitemporal supersession with atomic-set semantics.
 *
 * GGCC rows have no natural per-row identity in the payload (no id, all rows share
 * vigenciaDesde = fechaInicio). The right operation is therefore "is the active set
 * the same as the payload set?":
 *
 *   - Sets equal     → no-op.
 *   - Sets differ    → supersede every active row, insert every payload row.
 *
 * This preserves history without requiring per-row matching. Equivalent in shape to
 * the old `deleteMany + createMany`, but supersession instead of physical deletion.
 */
export async function persistGGCC(
  tx: Prisma.TransactionClient,
  contratoId: string,
  ggcc: ContractsPayloadShape["ggcc"],
  fechaInicio: string,
  fechaTermino: string,
  options: PersistGGCCOptions
): Promise<void> {
  const now = options.now ?? new Date();

  const existing = await tx.contractCommonExpense.findMany({
    where: { contratoId, supersededAt: null }
  });

  const existingKeys = new Set(existing.map(ggccCanonicalKey));
  const payloadKeys = new Set(ggcc.map(ggccCanonicalKey));

  const setsEqual =
    existingKeys.size === payloadKeys.size &&
    [...existingKeys].every((k) => payloadKeys.has(k));

  if (setsEqual) {
    return;
  }

  if (existing.length > 0) {
    await tx.contractCommonExpense.updateMany({
      where: { id: { in: existing.map((row) => row.id) } },
      data: {
        supersededAt: now,
        supersededBy: options.userId,
        supersedeReason: options.supersedeReason ?? null,
        amendmentId: options.amendmentId
      }
    });
  }

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
        mesesReajuste: item.mesesReajuste ?? null,
        amendmentId: options.amendmentId
      }))
    });
  }
}
