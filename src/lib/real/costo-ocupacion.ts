/**
 * Builds the all-tenant occupancy cost table.
 * Replicates CDG Excel "Costo Ocupación (%)" sheet logic.
 */

import type { CostoOcupacionResponse, CostoOcupacionRow } from "@/types/occupancy-cost";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type CostoTenantInput = {
  id: string;
  nombreComercial: string;
  contratos: {
    localId: string;
    local: {
      id: string;
      codigo: string;
      nombre: string;
      glam2: DecimalLike;
      esGLA: boolean;
      categoriaTamano: string | null;
    };
  }[];
};

export type CostoRecordInput = {
  tenantId: string | null;
  unitId: string | null;
  period: Date;
  valueUf: DecimalLike;
};

export type CostoSaleInput = {
  tenantId: string;
  period: Date;
  salesUf: DecimalLike;
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

  // Prefer tenant-level attribution when accounting records have tenantId.
  // Fall back to unit attribution only for older/unmapped records.
  const billingByTenant = new Map<string, Map<string, number>>();
  const billingByUnit = new Map<string, Map<string, number>>();
  for (const r of records) {
    const p = pKey(r.period);
    if (r.tenantId) {
      const tenantMap = billingByTenant.get(r.tenantId) ?? new Map<string, number>();
      tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(r.valueUf));
      billingByTenant.set(r.tenantId, tenantMap);
      continue;
    }
    if (!r.unitId) continue;
    const unitMap = billingByUnit.get(r.unitId) ?? new Map<string, number>();
    unitMap.set(p, (unitMap.get(p) ?? 0) + toNum(r.valueUf));
    billingByUnit.set(r.unitId, unitMap);
  }

  // Index sales by tenantId + period
  const salesByTenant = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = pKey(s.period);
    const tMap = salesByTenant.get(s.tenantId) ?? new Map<string, number>();
    tMap.set(p, (tMap.get(p) ?? 0) + toNum(s.salesUf));
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

    // Dominant categoriaTamano = the one with the largest GLA share among the
    // tenant's units. Ties broken by first occurrence. Falls back to "Sin clasificar".
    const tamanoTotals = new Map<string, number>();
    for (const local of unitMap.values()) {
      const key = (local.categoriaTamano ?? "").trim() || "Sin clasificar";
      tamanoTotals.set(key, (tamanoTotals.get(key) ?? 0) + toNum(local.glam2));
    }
    let categoriaTamano = "Sin clasificar";
    let dominantGla = -1;
    for (const [name, gla] of tamanoTotals) {
      if (gla > dominantGla) {
        dominantGla = gla;
        categoriaTamano = name;
      }
    }

    // Billing for this tenant (sum across all units)
    const tenantBilling = billingByTenant.get(tenant.id);
    let billingMonth = tenantBilling?.get(period) ?? 0;
    let billingYtd = 0;
    if (tenantBilling) {
      for (const [p, v] of tenantBilling) {
        if (p >= ytdFrom && p <= period) billingYtd += v;
      }
    }
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

    const salesUf = salesMonth;
    const salesYtdUf = salesYtd;

    const facturacionUfM2 = billingMonth / glaM2;
    const ventasUfM2 = salesUf / glaM2;
    const costoOcupacionPct = salesUf > 0 ? (billingMonth / salesUf) * 100 : null;

    const facturacionYtdUfM2 = billingYtd / glaM2;
    const ventasYtdUfM2 = salesYtdUf / glaM2;
    const costoOcupacionYtdPct = salesYtdUf > 0 ? (billingYtd / salesYtdUf) * 100 : null;

    rows.push({
      tenantId: tenant.id,
      tenantName: tenant.nombreComercial,
      categoriaTamano,
      locales,
      glaM2,
      facturacionUf: billingMonth,
      ventasUf: salesUf,
      facturacionUfM2,
      ventasUfM2,
      costoOcupacionPct,
      facturacionYtdUf: billingYtd,
      ventasYtdUf: salesYtdUf,
      facturacionYtdUfM2,
      ventasYtdUfM2,
      costoOcupacionYtdPct
    });
  }

  rows.sort((a, b) => (b.costoOcupacionPct ?? -1) - (a.costoOcupacionPct ?? -1));

  return { period, ytdFrom, rows };
}
