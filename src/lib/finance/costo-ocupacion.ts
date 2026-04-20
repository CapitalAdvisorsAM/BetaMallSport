/**
 * Builds the all-tenant occupancy cost table.
 * Replicates CDG Excel "Costo Ocupación (%)" sheet logic.
 */

import type { CostoOcupacionResponse, CostoOcupacionRow } from "@/types/costo-ocupacion";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type CostoTenantInput = {
  id: string;
  nombreComercial: string;
  contratos: {
    localId: string;
    local: { id: string; codigo: string; nombre: string; glam2: DecimalLike; esGLA: boolean };
  }[];
};

export type CostoRecordInput = {
  unitId: string | null;
  period: Date;
  valueUf: DecimalLike;
};

export type CostoSaleInput = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function pKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildCostoOcupacionTable(
  tenants: CostoTenantInput[],
  records: CostoRecordInput[],
  sales: CostoSaleInput[],
  period: string
): CostoOcupacionResponse {
  const year = period.slice(0, 4);
  const ytdFrom = `${year}-01`;

  // Index billing by unitId + period
  const billingByUnit = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!r.unitId) continue;
    const p = pKey(r.period);
    const unitMap = billingByUnit.get(r.unitId) ?? new Map<string, number>();
    unitMap.set(p, (unitMap.get(p) ?? 0) + toNum(r.valueUf));
    billingByUnit.set(r.unitId, unitMap);
  }

  // Index sales by tenantId + period
  const salesByTenant = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = pKey(s.period);
    const tMap = salesByTenant.get(s.tenantId) ?? new Map<string, number>();
    tMap.set(p, (tMap.get(p) ?? 0) + toNum(s.salesPesos));
    salesByTenant.set(s.tenantId, tMap);
  }

  const rows: CostoOcupacionRow[] = [];

  for (const tenant of tenants) {
    if (tenant.contratos.length === 0) continue;

    // Unique units
    const unitMap = new Map(
      tenant.contratos.map((c) => [c.local.id, c.local])
    );
    const locales = [...unitMap.values()].map((l) => ({ codigo: l.codigo, nombre: l.nombre }));
    const glaM2 = [...unitMap.values()]
      .filter((l) => l.esGLA)
      .reduce((s, l) => s + toNum(l.glam2), 0);

    if (glaM2 <= 0) continue;

    // Billing for this tenant (sum across all units)
    let billingMonth = 0;
    let billingYtd = 0;
    for (const local of unitMap.values()) {
      const unitBilling = billingByUnit.get(local.id);
      if (!unitBilling) continue;
      billingMonth += unitBilling.get(period) ?? 0;
      for (const [p, v] of unitBilling) {
        if (p >= ytdFrom && p <= period) billingYtd += v;
      }
    }

    // Sales for this tenant
    const tenantSales = salesByTenant.get(tenant.id);
    const salesMonth = tenantSales?.get(period) ?? 0;
    let salesYtd = 0;
    if (tenantSales) {
      for (const [p, v] of tenantSales) {
        if (p >= ytdFrom && p <= period) salesYtd += v;
      }
    }

    const facturacionUfM2 = billingMonth / glaM2;
    const ventasUfM2 = salesMonth / glaM2;
    const costoOcupacionPct = salesMonth > 0 ? (billingMonth / salesMonth) * 100 : null;

    const facturacionYtdUfM2 = billingYtd / glaM2;
    const ventasYtdUfM2 = salesYtd / glaM2;
    const costoOcupacionYtdPct = salesYtd > 0 ? (billingYtd / salesYtd) * 100 : null;

    rows.push({
      tenantId: tenant.id,
      tenantName: tenant.nombreComercial,
      locales,
      glaM2,
      facturacionUfM2,
      ventasUfM2,
      costoOcupacionPct,
      facturacionYtdUfM2,
      ventasYtdUfM2,
      costoOcupacionYtdPct
    });
  }

  rows.sort((a, b) => (b.costoOcupacionPct ?? -1) - (a.costoOcupacionPct ?? -1));

  return { period, ytdFrom, rows };
}
