/**
 * Bitemporal helpers for ContractRate and ContractRateDiscount.
 *
 * Two time axes:
 *   - Valid time:       vigenciaDesde / vigenciaHasta — when the rate applies in reality.
 *   - Transaction time: createdAt / supersededAt     — when the row was known to the system.
 *
 * Default queries return the "current truth" (supersededAt IS NULL).
 * Pass `asOf` to reconstruct what the system believed at a past moment in transaction time.
 *
 * Always prefer these helpers over raw prisma.contractRate.findMany — direct queries
 * see superseded rows and yield ghosts after corrections/backdating.
 */
import type {
  ContractCommonExpense,
  ContractDiscountType,
  ContractRate,
  ContractRateDiscount,
  Prisma
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Shape that older code paths and the rent-roll form expect: a single discount
 * embedded in the rate row as four flat fields. After the bitemporal refactor,
 * discounts live in their own ContractRateDiscount table — this helper bridges
 * back to the legacy shape so existing serializers and the form keep working
 * unchanged.
 *
 * When the form is rebuilt to support multiple discounts per rate natively,
 * delete this and consume `discounts: ContractRateDiscount[]` directly.
 */
export type LegacyDiscountFields = {
  descuentoTipo: ContractDiscountType | null;
  descuentoValor: string | null;
  descuentoDesde: string | null;
  descuentoHasta: string | null;
};

/**
 * Picks the first active discount (sorted by vigenciaDesde ascending) and projects
 * it into the legacy four-field shape. Returns nulls when there is no active discount.
 *
 * Caller responsibility: pass the ALREADY-FILTERED active discounts (supersededAt: null).
 * This helper does not re-filter — it trusts its input.
 */
export function legacyDiscountFields(
  discounts: Array<Pick<ContractRateDiscount, "tipo" | "valor" | "vigenciaDesde" | "vigenciaHasta">>
): LegacyDiscountFields {
  if (discounts.length === 0) {
    return {
      descuentoTipo: null,
      descuentoValor: null,
      descuentoDesde: null,
      descuentoHasta: null
    };
  }
  const sorted = [...discounts].sort(
    (a, b) => a.vigenciaDesde.getTime() - b.vigenciaDesde.getTime()
  );
  const d = sorted[0];
  return {
    descuentoTipo: d.tipo,
    descuentoValor: d.valor.toString(),
    descuentoDesde: d.vigenciaDesde.toISOString().slice(0, 10),
    descuentoHasta: d.vigenciaHasta?.toISOString().slice(0, 10) ?? null
  };
}

type DbClient = Pick<typeof prisma, "contractRate" | "contractRateDiscount" | "contractCommonExpense">;

export type AsOfFilter = {
  /** Calendar date the row must cover (vigenciaDesde ≤ validAt ≤ vigenciaHasta, treating null hasta as +infinity). */
  validAt: Date;
  /** Transaction-time perspective. Default: current truth (supersededAt IS NULL). */
  asOf?: Date;
};

/**
 * Where fragment for transaction-time. Without asOf returns "currently active".
 * With asOf reconstructs "what was active as of asOf".
 *
 * Shape is compatible with both ContractRate and ContractRateDiscount where inputs
 * (both have createdAt + supersededAt with identical semantics).
 */
export function activeAsOfWhere(
  asOf?: Date
): Prisma.ContractRateWhereInput {
  if (asOf === undefined) {
    return { supersededAt: null };
  }
  return {
    AND: [
      { createdAt: { lte: asOf } },
      {
        OR: [{ supersededAt: null }, { supersededAt: { gt: asOf } }]
      }
    ]
  };
}

/**
 * Where fragment for valid-time coverage. vigenciaHasta is inclusive.
 * A null vigenciaHasta is treated as +infinity (open-ended).
 */
export function coversValidAtWhere(
  validAt: Date
): Prisma.ContractRateWhereInput {
  return {
    AND: [
      { vigenciaDesde: { lte: validAt } },
      {
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: validAt } }]
      }
    ]
  };
}

export type ContractRateWithDiscounts = ContractRate & {
  discounts: ContractRateDiscount[];
};

/**
 * Returns all rates of a contract effective at `validAt` from the perspective of `asOf`.
 * Includes active discounts (filtered with the same time semantics).
 *
 * Multiple rates may be returned — different `tipo` values, multiple PORCENTAJE tiers, etc.
 */
export async function getTarifasVigentes(
  contratoId: string,
  filter: AsOfFilter,
  client: DbClient = prisma
): Promise<ContractRateWithDiscounts[]> {
  const { validAt, asOf } = filter;
  return client.contractRate.findMany({
    where: {
      contratoId,
      AND: [coversValidAtWhere(validAt), activeAsOfWhere(asOf)]
    },
    include: {
      discounts: {
        where: {
          AND: [
            coversValidAtWhere(validAt) as Prisma.ContractRateDiscountWhereInput,
            activeAsOfWhere(asOf) as Prisma.ContractRateDiscountWhereInput
          ]
        }
      }
    },
    orderBy: [{ tipo: "asc" }, { umbralVentasUf: "asc" }]
  });
}

/**
 * Returns active discounts of a single rate at `validAt` from the perspective of `asOf`.
 */
export async function getDescuentosVigentes(
  contractRateId: string,
  filter: AsOfFilter,
  client: DbClient = prisma
): Promise<ContractRateDiscount[]> {
  const { validAt, asOf } = filter;
  // The fragments are structurally compatible across ContractRate and ContractRateDiscount
  // (both tables share createdAt, supersededAt, vigenciaDesde, vigenciaHasta with identical
  // semantics). The cast acknowledges this without rebuilding the fragment per table.
  return client.contractRateDiscount.findMany({
    where: {
      contractRateId,
      AND: [
        coversValidAtWhere(validAt) as Prisma.ContractRateDiscountWhereInput,
        activeAsOfWhere(asOf) as Prisma.ContractRateDiscountWhereInput
      ]
    },
    orderBy: { vigenciaDesde: "asc" }
  });
}

/**
 * Returns ALL rates of a contract regardless of valid time — useful when you need
 * the full timeline (e.g. rendering an editable schedule of escalations).
 *
 * Defaults to current truth. Pass `asOf` to view the timeline as of a past moment.
 */
export async function getTarifasTimeline(
  contratoId: string,
  asOf?: Date,
  client: DbClient = prisma
): Promise<ContractRateWithDiscounts[]> {
  return client.contractRate.findMany({
    where: {
      contratoId,
      ...activeAsOfWhere(asOf)
    },
    include: {
      discounts: {
        where: activeAsOfWhere(asOf) as Prisma.ContractRateDiscountWhereInput
      }
    },
    orderBy: [{ tipo: "asc" }, { umbralVentasUf: "asc" }, { vigenciaDesde: "asc" }]
  });
}

/**
 * Returns the GGCC profile of a contract effective at `validAt` from the perspective
 * of `asOf`. Typically a contract has a single GGCC row, but the helper returns an
 * array to handle edge cases (multiple variants).
 */
export async function getGGCCVigentes(
  contratoId: string,
  filter: AsOfFilter,
  client: DbClient = prisma
): Promise<ContractCommonExpense[]> {
  const { validAt, asOf } = filter;
  return client.contractCommonExpense.findMany({
    where: {
      contratoId,
      AND: [
        coversValidAtWhere(validAt) as Prisma.ContractCommonExpenseWhereInput,
        activeAsOfWhere(asOf) as Prisma.ContractCommonExpenseWhereInput
      ]
    },
    orderBy: { vigenciaDesde: "asc" }
  });
}

/**
 * Returns the full GGCC timeline of a contract, defaulting to current truth.
 * Pass `asOf` to view the timeline as it was at a past moment.
 */
export async function getGGCCTimeline(
  contratoId: string,
  asOf?: Date,
  client: DbClient = prisma
): Promise<ContractCommonExpense[]> {
  return client.contractCommonExpense.findMany({
    where: {
      contratoId,
      ...(activeAsOfWhere(asOf) as Prisma.ContractCommonExpenseWhereInput)
    },
    orderBy: { vigenciaDesde: "asc" }
  });
}
