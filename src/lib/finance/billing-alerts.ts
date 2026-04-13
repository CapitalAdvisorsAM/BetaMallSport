import type { BillingAlertSeverity } from "@prisma/client";
import { ContractRateType, Prisma } from "@prisma/client";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { shiftPeriod, calcTieredVariableRent } from "@/lib/finance/billing-utils";
import { prisma } from "@/lib/prisma";

const GAP_THRESHOLD_PCT = 5;
const WARNING_MONTHS = 3;
const CRITICAL_MONTHS = 6;
const LOOKBACK_MONTHS = 8; // look back enough to detect 6 consecutive months

type TenantGapResult = {
  arrendatarioId: string;
  consecutiveMonths: number;
  avgGapPct: number;
  latestPeriod: string;
};

/**
 * Recalculate billing alerts for all tenants in a project.
 * Called after accounting data upload.
 */
export async function recalculateBillingAlerts(projectId: string): Promise<void> {
  // Build the lookback period range
  const now = new Date();
  const lookbackStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - LOOKBACK_MONTHS, 1));
  const lookbackEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Get all active tenants with their contracts
  const tenants = await prisma.tenant.findMany({
    where: { proyectoId: projectId, vigente: true },
    select: {
      id: true,
      contratos: {
        where: { estado: { in: ["VIGENTE", "GRACIA"] } },
        select: {
          localId: true,
          local: { select: { glam2: true } },
          tarifas: {
            where: {
              tipo: { in: ["FIJO_UF_M2", "FIJO_UF", "PORCENTAJE"] },
              vigenciaDesde: { lte: lookbackEnd }
            },
            orderBy: { vigenciaDesde: "desc" as const },
            select: { tipo: true, valor: true, umbralVentasUf: true }
          },
          ggcc: {
            where: { vigenciaDesde: { lte: lookbackEnd } },
            orderBy: { vigenciaDesde: "desc" as const },
            take: 1,
            select: { tarifaBaseUfM2: true, pctAdministracion: true }
          }
        }
      }
    }
  });

  // Get all accounting records and sales for the lookback period
  const unitIds = [...new Set(tenants.flatMap((t) => t.contratos.map((c) => c.localId)))];
  if (unitIds.length === 0) return;

  const tenantIds = tenants.map((t) => t.id);

  // Sales query needs 1 extra month before lookback for the lag
  const salesLookbackStart = new Date(Date.UTC(
    lookbackStart.getUTCFullYear(),
    lookbackStart.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS,
    1
  ));

  const [accountingRecords, salesRecords] = await Promise.all([
    prisma.accountingRecord.findMany({
      where: {
        projectId,
        unitId: { in: unitIds },
        period: { gte: lookbackStart, lte: lookbackEnd },
        group1: "INGRESOS DE EXPLOTACION"
      },
      select: { unitId: true, period: true, valueUf: true }
    }),
    prisma.tenantSale.findMany({
      where: {
        projectId,
        tenantId: { in: tenantIds },
        period: { gte: salesLookbackStart, lte: lookbackEnd }
      },
      select: { tenantId: true, period: true, salesUf: true }
    })
  ]);

  // Build sales by tenant+period
  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of salesRecords) {
    const p = s.period.toISOString().slice(0, 7);
    const tenantMap = salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + Number(s.salesUf));
    salesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  // Build actual billing: unitId -> period -> totalUf
  const actualByUnitPeriod = new Map<string, Map<string, number>>();
  for (const r of accountingRecords) {
    if (!r.unitId) continue;
    const p = r.period.toISOString().slice(0, 7);
    const unitMap = actualByUnitPeriod.get(r.unitId) ?? new Map<string, number>();
    unitMap.set(p, (unitMap.get(p) ?? 0) + Number(r.valueUf));
    actualByUnitPeriod.set(r.unitId, unitMap);
  }

  // Build periods list (sorted ascending)
  const periods: string[] = [];
  const cursor = new Date(lookbackStart);
  while (cursor <= lookbackEnd) {
    periods.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Calculate gap per tenant per period, then find consecutive streaks
  const tenantResults: TenantGapResult[] = [];

  for (const tenant of tenants) {
    if (tenant.contratos.length === 0) continue;

    // Pre-compute fixed expected (rent + GGCC) — same every month
    let baseExpected = 0;
    const varRatesByUnit: { localId: string; tiers: Array<{ umbralVentasUf: number; pct: number }>; fixedRentUf: number }[] = [];

    for (const c of tenant.contratos) {
      const glam2 = Number(c.local.glam2?.toString() ?? "0");
      let contractFixedRent = 0;
      const fixedTarifa = c.tarifas.find(
        (t) => t.tipo === ContractRateType.FIJO_UF_M2 || t.tipo === ContractRateType.FIJO_UF
      );
      if (fixedTarifa) {
        if (fixedTarifa.tipo === "FIJO_UF_M2") contractFixedRent = Number(fixedTarifa.valor.toString()) * glam2;
        else if (fixedTarifa.tipo === "FIJO_UF") contractFixedRent = Number(fixedTarifa.valor.toString());
      }
      baseExpected += contractFixedRent;

      const ggcc = c.ggcc[0];
      if (ggcc) {
        const base = Number(ggcc.tarifaBaseUfM2.toString()) * glam2;
        baseExpected += base + (Number(ggcc.pctAdministracion.toString()) / 100) * base;
      }

      const varTarifas = c.tarifas.filter((t) => t.tipo === ContractRateType.PORCENTAJE);
      if (varTarifas.length > 0) {
        const tiers = varTarifas.map((t) => ({
          umbralVentasUf: Number(t.umbralVentasUf?.toString() ?? "0"),
          pct: Number(t.valor.toString()),
        }));
        varRatesByUnit.push({
          localId: c.localId,
          tiers,
          fixedRentUf: contractFixedRent
        });
      }
    }

    if (baseExpected <= 0 && varRatesByUnit.length === 0) continue;

    const unitIdsForTenant = tenant.contratos.map((c) => c.localId);

    // Check consecutive months with gap > threshold (walking backwards from most recent)
    let consecutiveCount = 0;
    let totalGapPct = 0;
    let latestPeriod = "";

    for (let i = periods.length - 1; i >= 0; i--) {
      const period = periods[i];

      // Calculate expected for this period (base + variable with lag)
      let expectedForPeriod = baseExpected;
      for (const vr of varRatesByUnit) {
        const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
        const unitSales = salesByTenantPeriod.get(tenant.id)?.get(lagPeriod) ?? 0;
        expectedForPeriod += calcTieredVariableRent(unitSales, vr.tiers, vr.fixedRentUf);
      }

      let actualForPeriod = 0;
      for (const uid of unitIdsForTenant) {
        actualForPeriod += actualByUnitPeriod.get(uid)?.get(period) ?? 0;
      }

      // If no actual data for this period, don't count it (data might not be uploaded yet)
      if (actualForPeriod === 0 && !unitIdsForTenant.some((uid) => actualByUnitPeriod.get(uid)?.has(period))) {
        break; // Stop counting — gap in data
      }

      const gapPct = expectedForPeriod > 0 ? ((expectedForPeriod - actualForPeriod) / expectedForPeriod) * 100 : 0;
      if (gapPct >= GAP_THRESHOLD_PCT) {
        consecutiveCount++;
        totalGapPct += gapPct;
        if (!latestPeriod) latestPeriod = period;
      } else {
        break; // Streak broken
      }
    }

    if (consecutiveCount >= WARNING_MONTHS) {
      tenantResults.push({
        arrendatarioId: tenant.id,
        consecutiveMonths: consecutiveCount,
        avgGapPct: totalGapPct / consecutiveCount,
        latestPeriod
      });
    }
  }

  // Upsert alerts and resolve old ones in a transaction
  await prisma.$transaction(async (tx) => {
    // Get existing active alerts for this project
    const existingAlerts = await tx.billingAlert.findMany({
      where: { proyectoId: projectId, resolvedAt: null }
    });
    const existingByTenant = new Map(existingAlerts.map((a) => [a.arrendatarioId, a]));

    // Tenants that should have alerts
    const alertedTenantIds = new Set(tenantResults.map((r) => r.arrendatarioId));

    // Resolve alerts for tenants that no longer exceed threshold
    const toResolve = existingAlerts.filter((a) => !alertedTenantIds.has(a.arrendatarioId));
    if (toResolve.length > 0) {
      await tx.billingAlert.updateMany({
        where: { id: { in: toResolve.map((a) => a.id) } },
        data: { resolvedAt: new Date() }
      });
    }

    // Upsert alerts for tenants that exceed threshold
    for (const result of tenantResults) {
      const severity: BillingAlertSeverity = result.consecutiveMonths >= CRITICAL_MONTHS ? "CRITICAL" : "WARNING";
      const existing = existingByTenant.get(result.arrendatarioId);

      if (existing) {
        await tx.billingAlert.update({
          where: { id: existing.id },
          data: {
            severity,
            consecutiveMonths: result.consecutiveMonths,
            avgGapPct: new Prisma.Decimal(result.avgGapPct.toFixed(2)),
            latestPeriod: result.latestPeriod,
            resolvedAt: null
          }
        });
      } else {
        await tx.billingAlert.create({
          data: {
            proyectoId: projectId,
            arrendatarioId: result.arrendatarioId,
            severity,
            consecutiveMonths: result.consecutiveMonths,
            avgGapPct: new Prisma.Decimal(result.avgGapPct.toFixed(2)),
            latestPeriod: result.latestPeriod
          }
        });
      }
    }
  });
}
