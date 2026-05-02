/**
 * Builds a 2-D cross-tab of sales (UF, GLA, UF/m², share %, YoY %) over an
 * arbitrary pair of dimensions (rowDim × colDim) for a single period or a
 * summed period range.
 *
 * Dimensional attribution reuses `distributeSalesToUnits` from ventas-timeseries
 * but distributes against a `(rowDim, colDim)` composite key per unit.
 */

import type { Prisma, UnitType } from "@prisma/client";
import { mapCategoria } from "@/lib/kpi";
import {
  mapTamanoFromUnit,
  type DimensionField,
  type GlaUnitInput,
  type TenantRubroByUnitId
} from "@/lib/real/gla-by-dimension";
import { toNum } from "@/lib/real/billing-utils";
import { tenantDimensionGlaForPeriod, periodKey } from "@/lib/real/ventas-timeseries";
import type {
  VentasCrosstabCell,
  VentasCrosstabResponse,
  SalesDimension
} from "@/types/sales-analytics";

type DecimalLike = number | string | { toString(): string };

export type CrosstabUnitInput = {
  id: string;
  tipo: UnitType;
  esGLA: boolean;
  glam2: DecimalLike;
  piso: string;
  categoriaTamano: string | null;
  zona: string | null;
};

export type CrosstabContractInput = {
  localId: string;
  arrendatarioId: string;
  fechaInicio: Date;
  fechaTermino: Date;
};

export type CrosstabSaleInput = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

function unitDimensionValue(
  unit: CrosstabUnitInput,
  dim: DimensionField,
  rubro?: TenantRubroByUnitId
): string | null {
  if (dim === "tipo") return mapCategoria(unit.zona);
  if (dim === "tamano") {
    return mapTamanoFromUnit({
      id: unit.id,
      tipo: unit.tipo,
      esGLA: unit.esGLA,
      glam2: unit.glam2,
      piso: unit.piso,
      categoriaTamano: unit.categoriaTamano
    } satisfies GlaUnitInput);
  }
  if (dim === "zona") return unit.zona?.trim() || null;
  if (dim === "rubro") return rubro?.get(unit.id) ?? null;
  return unit.piso || null;
}

function emptyCell(): VentasCrosstabCell {
  return { salesUf: 0, glaM2: 0, ufPerM2: 0, sharePct: null, yoyPct: null };
}

function finalize(cell: VentasCrosstabCell, grandSalesUf: number, priorSalesUf: number | null): VentasCrosstabCell {
  const ufPerM2 = cell.glaM2 > 0 ? cell.salesUf / cell.glaM2 : 0;
  const sharePct = grandSalesUf > 0 ? (cell.salesUf / grandSalesUf) * 100 : null;
  const yoyPct =
    priorSalesUf === null || priorSalesUf === 0
      ? null
      : ((cell.salesUf - priorSalesUf) / Math.abs(priorSalesUf)) * 100;
  return { salesUf: cell.salesUf, glaM2: cell.glaM2, ufPerM2, sharePct, yoyPct };
}

export type BuildSalesCrosstabArgs = {
  sales: CrosstabSaleInput[];
  priorSales: CrosstabSaleInput[] | null;
  contracts: CrosstabContractInput[];
  units: CrosstabUnitInput[];
  periods: string[];
  rowDim: SalesDimension;
  colDim: SalesDimension;
  ufByPeriod: Map<string, number>;
  tenantRubroByUnitId?: TenantRubroByUnitId;
};

/**
 * Build the crosstab. `periods` is the list of periods to sum over (one or many).
 */
export function buildSalesCrosstab(args: BuildSalesCrosstabArgs): VentasCrosstabResponse {
  const {
    sales,
    priorSales,
    contracts,
    units,
    periods,
    rowDim,
    colDim,
    ufByPeriod,
    tenantRubroByUnitId
  } = args;

  const periodSet = new Set(periods);
  const unitById = new Map(units.map((u) => [u.id, u]));

  // GLA buckets per (row, col) per period: occupied units only.
  const glaByCell = new Map<string, Map<string, Map<string, number>>>(); // row → col → period → gla
  for (const period of periods) {
    const periodEnd = new Date(`${period}-01T00:00:00Z`);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    periodEnd.setUTCDate(0);

    const occupied = new Set<string>();
    for (const c of contracts) {
      if (c.fechaInicio <= periodEnd && c.fechaTermino >= periodEnd) {
        occupied.add(c.localId);
      }
    }
    for (const localId of occupied) {
      const unit = unitById.get(localId);
      if (!unit || !unit.esGLA) continue;
      const r = unitDimensionValue(unit, rowDim, tenantRubroByUnitId);
      const cc = unitDimensionValue(unit, colDim, tenantRubroByUnitId);
      if (!r || !cc) continue;
      const rowMap = glaByCell.get(r) ?? new Map<string, Map<string, number>>();
      const colMap = rowMap.get(cc) ?? new Map<string, number>();
      colMap.set(period, (colMap.get(period) ?? 0) + toNum(unit.glam2));
      rowMap.set(cc, colMap);
      glaByCell.set(r, rowMap);
    }
  }

  // Sales attribution per (row, col): distribute tenant sales across composite buckets.
  const salesByCell = new Map<string, Map<string, number>>(); // row → col → salesPesos summed over `periods`
  const distributeSales = (saleList: CrosstabSaleInput[], target: Map<string, Map<string, number>>): void => {
    for (const sale of saleList) {
      const p = periodKey(sale.period);
      if (!periodSet.has(p)) continue;
      const tenantUnits = tenantDimensionGlaForPeriod(
        contracts,
        units.map((u) => ({
          id: u.id,
          glam2: u.glam2,
          dimensionValue: "_unused_"
        })),
        p
      ).get(sale.tenantId);
      if (!tenantUnits || tenantUnits.length === 0) continue;
      // Re-resolve dimensional values per unit (tenantDimensionGlaForPeriod
      // returned the placeholder dim above; we need the (row,col) tuple here).
      const composites: { row: string; col: string; gla: number }[] = [];
      for (const c of contracts) {
        if (c.arrendatarioId !== sale.tenantId) continue;
        const periodEnd = new Date(`${p}-01T00:00:00Z`);
        periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
        periodEnd.setUTCDate(0);
        const periodStart = new Date(`${p}-01T00:00:00Z`);
        if (c.fechaInicio > periodEnd || c.fechaTermino < periodStart) continue;
        const unit = unitById.get(c.localId);
        if (!unit || !unit.esGLA) continue;
        const r = unitDimensionValue(unit, rowDim, tenantRubroByUnitId);
        const cc = unitDimensionValue(unit, colDim, tenantRubroByUnitId);
        if (!r || !cc) continue;
        composites.push({ row: r, col: cc, gla: toNum(unit.glam2) });
      }
      const totalGla = composites.reduce((s, x) => s + x.gla, 0);
      if (totalGla <= 0) continue;
      const salesPesos = toNum(sale.salesPesos);
      for (const x of composites) {
        const share = (x.gla / totalGla) * salesPesos;
        const rowMap = target.get(x.row) ?? new Map<string, number>();
        rowMap.set(x.col, (rowMap.get(x.col) ?? 0) + share);
        target.set(x.row, rowMap);
      }
    }
  };

  distributeSales(sales, salesByCell);

  const priorSalesByCell = new Map<string, Map<string, number>>();
  if (priorSales) {
    // Shift prior-year sales forward by 12 months so they align with current periods.
    const shifted = priorSales.map((s) => {
      const d = new Date(s.period);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return { ...s, period: d };
    });
    distributeSales(shifted, priorSalesByCell);
  }

  // Convert salesPesos → salesUf using the period's UF rate weighted-sum.
  // Since salesByCell already aggregates over periods, we cannot know which UF
  // applies; instead, we apply per-period UF during distribution above.
  // To do that correctly, redo the distribution but track UF per period.
  // (Simpler: re-compute using period-sliced aggregation.)
  const salesUfByCell = new Map<string, Map<string, number>>();
  const priorSalesUfByCell = new Map<string, Map<string, number>>();

  const accumulateUf = (
    saleList: CrosstabSaleInput[],
    target: Map<string, Map<string, number>>,
    shiftYears = 0
  ): void => {
    for (const sale of saleList) {
      const origPeriod = sale.period;
      const adjPeriod = shiftYears
        ? new Date(Date.UTC(origPeriod.getUTCFullYear() + shiftYears, origPeriod.getUTCMonth(), 1))
        : origPeriod;
      const p = periodKey(adjPeriod);
      if (!periodSet.has(p)) continue;
      const uf = ufByPeriod.get(p) ?? 0;
      if (uf <= 0) continue;
      const composites: { row: string; col: string; gla: number }[] = [];
      const periodEnd = new Date(`${p}-01T00:00:00Z`);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
      periodEnd.setUTCDate(0);
      const periodStart = new Date(`${p}-01T00:00:00Z`);
      for (const c of contracts) {
        if (c.arrendatarioId !== sale.tenantId) continue;
        if (c.fechaInicio > periodEnd || c.fechaTermino < periodStart) continue;
        const unit = unitById.get(c.localId);
        if (!unit || !unit.esGLA) continue;
        const r = unitDimensionValue(unit, rowDim, tenantRubroByUnitId);
        const cc = unitDimensionValue(unit, colDim, tenantRubroByUnitId);
        if (!r || !cc) continue;
        composites.push({ row: r, col: cc, gla: toNum(unit.glam2) });
      }
      const totalGla = composites.reduce((s, x) => s + x.gla, 0);
      if (totalGla <= 0) continue;
      const salesUf = toNum(sale.salesPesos) / uf;
      for (const x of composites) {
        const share = (x.gla / totalGla) * salesUf;
        const rowMap = target.get(x.row) ?? new Map<string, number>();
        rowMap.set(x.col, (rowMap.get(x.col) ?? 0) + share);
        target.set(x.row, rowMap);
      }
    }
  };

  accumulateUf(sales, salesUfByCell);
  if (priorSales) accumulateUf(priorSales, priorSalesUfByCell, 1);

  // Collect row/col labels (union of GLA + sales sources).
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  for (const [r, m] of glaByCell) {
    rowSet.add(r);
    for (const c of m.keys()) colSet.add(c);
  }
  for (const [r, m] of salesUfByCell) {
    rowSet.add(r);
    for (const c of m.keys()) colSet.add(c);
  }

  const rows = [...rowSet].sort();
  const cols = [...colSet].sort();

  // Build raw cells (no derived metrics yet).
  const rawCells: VentasCrosstabCell[][] = rows.map((r) =>
    cols.map((c) => {
      const salesUf = salesUfByCell.get(r)?.get(c) ?? 0;
      // Sum GLA over all periods → "GLA-meses" (avg-equivalent denominator)
      let glaM2 = 0;
      const periodMap = glaByCell.get(r)?.get(c);
      if (periodMap) {
        for (const v of periodMap.values()) glaM2 += v;
      }
      // Average GLA across periods (so UF/m² stays in monthly units regardless
      // of how many months the user summed).
      glaM2 = periods.length > 0 ? glaM2 / periods.length : glaM2;
      return { salesUf, glaM2, ufPerM2: 0, sharePct: null, yoyPct: null };
    })
  );

  let grandSalesUf = 0;
  let grandPriorSalesUf = 0;
  for (const row of rawCells) for (const cell of row) grandSalesUf += cell.salesUf;
  for (const m of priorSalesUfByCell.values()) for (const v of m.values()) grandPriorSalesUf += v;

  const cells = rawCells.map((row, ri) =>
    row.map((cell, ci) => {
      const priorUf = priorSalesUfByCell.get(rows[ri])?.get(cols[ci]);
      return finalize(cell, grandSalesUf, priorUf ?? null);
    })
  );

  const rowTotals: VentasCrosstabCell[] = rows.map((r, ri) => {
    const sum = rawCells[ri].reduce<VentasCrosstabCell>(
      (acc, cell) => ({ ...acc, salesUf: acc.salesUf + cell.salesUf, glaM2: acc.glaM2 + cell.glaM2 }),
      emptyCell()
    );
    let priorRowUf = 0;
    const priorRowMap = priorSalesUfByCell.get(r);
    if (priorRowMap) for (const v of priorRowMap.values()) priorRowUf += v;
    return finalize(sum, grandSalesUf, priorSales ? priorRowUf : null);
  });

  const colTotals: VentasCrosstabCell[] = cols.map((c, ci) => {
    let salesUf = 0;
    let glaM2 = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      salesUf += rawCells[ri][ci].salesUf;
      glaM2 += rawCells[ri][ci].glaM2;
    }
    let priorColUf = 0;
    for (const [, m] of priorSalesUfByCell) priorColUf += m.get(c) ?? 0;
    return finalize({ salesUf, glaM2, ufPerM2: 0, sharePct: null, yoyPct: null }, grandSalesUf, priorSales ? priorColUf : null);
  });

  let grandGla = 0;
  for (const row of rawCells) for (const cell of row) grandGla += cell.glaM2;
  const grandTotal = finalize(
    { salesUf: grandSalesUf, glaM2: grandGla, ufPerM2: 0, sharePct: null, yoyPct: null },
    grandSalesUf,
    priorSales ? grandPriorSalesUf : null
  );

  return {
    mode: "crosstab",
    rowDim,
    colDim,
    rows,
    cols,
    cells,
    rowTotals,
    colTotals,
    grandTotal
  };
}

// Re-export Prisma type to keep callers tidy.
export type { Prisma };
