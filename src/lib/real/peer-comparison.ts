import { AccountingScenario, type PrismaClient } from "@prisma/client";
import { mapCategoria } from "@/lib/kpi";
import { buildUfRateMap, getUfRate } from "@/lib/real/uf-lookup";
import type { PeerComparison, PeerComparisonRow } from "@/types/tenant-360";

type DecimalLike = number | string | { toString(): string };

function toNum(value: DecimalLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

type BuildPeerComparisonInput = {
  projectId: string;
  tenantId: string;
  tenantName: string;
  categoria: string;
  desdeDate: Date;
  hastaDate: Date;
  prisma: PrismaClient;
};

export async function buildPeerComparison(
  input: BuildPeerComparisonInput
): Promise<PeerComparison | null> {
  const { projectId, tenantId, categoria, desdeDate, hastaDate, prisma } = input;

  const normalizedCategoria = mapCategoria(categoria);
  if (!normalizedCategoria) return null;

  // Find all active contracts in the same project with units in the same category
  const peerContracts = await prisma.contract.findMany({
    where: {
      projectId: projectId,
      estado: { in: ["VIGENTE", "GRACIA"] }
    },
    select: {
      arrendatarioId: true,
      localId: true,
      arrendatario: {
        select: { id: true, nombreComercial: true, razonSocial: true }
      },
      local: {
        select: { id: true, glam2: true, zona: { select: { nombre: true } } }
      }
    }
  });

  // Filter to same category
  const sameCategoryContracts = peerContracts.filter(
    (c) => mapCategoria(c.local.zona?.nombre ?? null) === normalizedCategoria
  );

  if (sameCategoryContracts.length < 2) return null;

  // Group by tenant
  const tenantMap = new Map<
    string,
    { name: string; glam2: number; unitIds: Set<string>; isCurrent: boolean }
  >();

  for (const c of sameCategoryContracts) {
    const tid = c.arrendatarioId;
    if (!tenantMap.has(tid)) {
      tenantMap.set(tid, {
        name: c.arrendatario.nombreComercial || c.arrendatario.razonSocial,
        glam2: 0,
        unitIds: new Set(),
        isCurrent: tid === tenantId
      });
    }
    const entry = tenantMap.get(tid)!;
    entry.glam2 += toNum(c.local.glam2);
    entry.unitIds.add(c.localId);
  }

  // Fetch billing and sales for all units in this category
  const allTenantIds = [...tenantMap.keys()];

  const [billingRecords, salesRecords] = await Promise.all([
    prisma.accountingRecord.findMany({
      where: {
        projectId,
        tenantId: { in: allTenantIds },
        period: { gte: desdeDate, lte: hastaDate },
        scenario: AccountingScenario.REAL,
        group1: "INGRESOS DE EXPLOTACION",
      },
      select: { tenantId: true, valueUf: true, period: true }
    }),
    prisma.tenantSale.findMany({
      where: {
        projectId,
        tenantId: { in: allTenantIds },
        period: { gte: desdeDate, lte: hastaDate }
      },
      select: { tenantId: true, period: true, salesPesos: true }
    })
  ]);

  // Aggregate billing by tenant; track distinct active months per tenant for
  // monthly-average normalization (so UF/m² is comparable against the tenant's
  // own KPI card and the Local Comercial YTD weighted average).
  const billingByTenant = new Map<string, number>();
  const billingMonthsByTenant = new Map<string, Set<string>>();
  for (const rec of billingRecords) {
    if (!rec.tenantId) continue;
    const valueUf = toNum(rec.valueUf);
    billingByTenant.set(rec.tenantId, (billingByTenant.get(rec.tenantId) ?? 0) + valueUf);
    if (valueUf > 0) {
      const period = rec.period.toISOString().slice(0, 7);
      const set = billingMonthsByTenant.get(rec.tenantId) ?? new Set<string>();
      set.add(period);
      billingMonthsByTenant.set(rec.tenantId, set);
    }
  }

  const ufRateByPeriod = await buildUfRateMap([
    ...new Set(salesRecords.map((sale) => sale.period.toISOString().slice(0, 7)))
  ]);

  // Aggregate sales in UF by tenant + active sales months per tenant.
  const salesByTenant = new Map<string, number>();
  const salesMonthsByTenant = new Map<string, Set<string>>();
  for (const s of salesRecords) {
    if (!s.tenantId) continue;
    const period = s.period.toISOString().slice(0, 7);
    const uf = getUfRate(period, ufRateByPeriod);
    const salesUf = uf > 0 ? toNum(s.salesPesos) / uf : 0;
    salesByTenant.set(s.tenantId, (salesByTenant.get(s.tenantId) ?? 0) + salesUf);
    if (salesUf > 0) {
      const set = salesMonthsByTenant.get(s.tenantId) ?? new Set<string>();
      set.add(period);
      salesMonthsByTenant.set(s.tenantId, set);
    }
  }

  // Build peer rows — UF/m² is monthly-average to match the Local Comercial tab.
  const peers: PeerComparisonRow[] = [];
  for (const [tid, entry] of tenantMap) {
    const totalBilling = billingByTenant.get(tid) ?? 0;
    const totalSalesUf = salesByTenant.get(tid) ?? 0;
    const glam2 = entry.glam2;
    const billingMonths = billingMonthsByTenant.get(tid)?.size ?? 0;
    const salesMonths = salesMonthsByTenant.get(tid)?.size ?? 0;
    const avgMonthlyBilling = billingMonths > 0 ? totalBilling / billingMonths : 0;
    const avgMonthlySalesUf = salesMonths > 0 ? totalSalesUf / salesMonths : 0;

    peers.push({
      tenantName: entry.name,
      glam2,
      facturacionUfM2: glam2 > 0 ? avgMonthlyBilling / glam2 : 0,
      ventasPesosM2: glam2 > 0 ? avgMonthlySalesUf / glam2 : 0,
      costoOcupacionPct: totalSalesUf > 0 ? (totalBilling / totalSalesUf) * 100 : null,
      isCurrent: entry.isCurrent
    });
  }

  // Sort: current tenant first, then by facturacion desc
  peers.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return b.facturacionUfM2 - a.facturacionUfM2;
  });

  const otherPeers = peers.filter((p) => !p.isCurrent);
  const currentPeer = peers.find((p) => p.isCurrent);

  const avgFacturacion =
    otherPeers.length > 0
      ? otherPeers.reduce((acc, p) => acc + p.facturacionUfM2, 0) / otherPeers.length
      : 0;
  const avgVentas =
    otherPeers.length > 0
      ? otherPeers.reduce((acc, p) => acc + p.ventasPesosM2, 0) / otherPeers.length
      : 0;
  const peersWithCosto = otherPeers.filter((p) => p.costoOcupacionPct !== null);
  const avgCosto =
    peersWithCosto.length > 0
      ? peersWithCosto.reduce((acc, p) => acc + (p.costoOcupacionPct ?? 0), 0) / peersWithCosto.length
      : null;

  return {
    categoria: normalizedCategoria,
    peerCount: otherPeers.length,
    avgFacturacionUfM2: avgFacturacion,
    avgVentasPesosM2: avgVentas,
    avgCostoOcupacionPct: avgCosto,
    currentFacturacionUfM2: currentPeer?.facturacionUfM2 ?? 0,
    currentVentasPesosM2: currentPeer?.ventasPesosM2 ?? 0,
    currentCostoOcupacionPct: currentPeer?.costoOcupacionPct ?? null,
    peers
  };
}
