export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  getFinanceFrom,
  getFinanceProjectId,
  getFinanceTo
} from "@/lib/real/api-params";
import { generatePeriods } from "@/lib/real/gla-by-dimension";
import { resolveMonthRange } from "@/lib/real/period-range";
import { buildTopTenants } from "@/lib/real/sales-top-tenants";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { TopTenantsResponse } from "@/types/sales-analytics";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function shiftYear(date: Date, deltaYears: number): Date {
  const out = new Date(date);
  out.setUTCFullYear(out.getUTCFullYear() + deltaYears);
  return out;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      return NextResponse.json({ message: "projectId requerido." }, { status: 400 });
    }

    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);
    const { desdeDate, hastaDate } = resolveMonthRange(from, to);
    const periods = generatePeriods(desdeDate, hastaDate);
    if (periods.length === 0) {
      return NextResponse.json({ rows: [] } satisfies TopTenantsResponse);
    }
    const hastaPeriod = periods[periods.length - 1];

    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Costo ocupación denominator anchored to YTD-of-`hasta`
    const year = hastaPeriod.slice(0, 4);
    const ytdStart = new Date(`${year}-01-01T00:00:00Z`);
    const ytdEnd = new Date(`${hastaPeriod}-01T00:00:00Z`);
    ytdEnd.setUTCMonth(ytdEnd.getUTCMonth() + 1);
    ytdEnd.setUTCDate(0);

    const priorDesde = shiftYear(desdeDate, -1);
    const priorHasta = shiftYear(hastaDate, -1);

    // Use the wider of [desdeDate, hastaDate], YTD window, and prior-year range
    // when fetching UF, to ensure all conversions have a rate available.
    const ufFrom = priorDesde < ytdStart ? priorDesde : ytdStart;
    const ufTo = ytdEnd > hastaDate ? ytdEnd : hastaDate;

    const [rawTenants, rawSales, rawPriorSales, rawYtdSales, rawContracts, rawUnits, rawRecords, rawUf] =
      await Promise.all([
        prisma.tenant.findMany({
          where: { projectId, vigente: true },
          select: { id: true, nombreComercial: true }
        }),
        prisma.tenantSale.findMany({
          where: { projectId, period: { gte: desdeDate, lte: hastaDate } },
          select: { tenantId: true, period: true, salesPesos: true }
        }),
        prisma.tenantSale.findMany({
          where: { projectId, period: { gte: priorDesde, lte: priorHasta } },
          select: { tenantId: true, period: true, salesPesos: true }
        }),
        prisma.tenantSale.findMany({
          where: { projectId, period: { gte: ytdStart, lte: ytdEnd } },
          select: { tenantId: true, period: true, salesPesos: true }
        }),
        prisma.contract.findMany({
          where: { projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
          select: {
            arrendatarioId: true,
            localId: true,
            fechaInicio: true,
            fechaTermino: true
          }
        }),
        prisma.unit.findMany({
          where: { projectId, estado: "ACTIVO" },
          select: { id: true, glam2: true, esGLA: true }
        }),
        prisma.accountingRecord.findMany({
          where: {
            projectId,
            period: { gte: ytdStart, lte: ytdEnd },
            scenario: AccountingScenario.REAL
          },
          select: { unitId: true, period: true, valueUf: true }
        }),
        prisma.valorUF.findMany({
          where: { fecha: { gte: ufFrom, lte: ufTo } },
          select: { fecha: true, valor: true },
          orderBy: { fecha: "asc" }
        })
      ]);

    const ufByPeriod = new Map<string, number>();
    for (const uf of rawUf) {
      const key = uf.fecha.toISOString().slice(0, 7);
      ufByPeriod.set(key, Number(uf.valor));
    }

    const rows = buildTopTenants({
      tenants: rawTenants.map((t) => ({ id: t.id, nombreComercial: t.nombreComercial })),
      sales: rawSales.map((s) => ({
        tenantId: s.tenantId,
        period: s.period,
        salesPesos: s.salesPesos
      })),
      priorSales: rawPriorSales.map((s) => ({
        tenantId: s.tenantId,
        period: s.period,
        salesPesos: s.salesPesos
      })),
      ytdSales: rawYtdSales.map((s) => ({
        tenantId: s.tenantId,
        period: s.period,
        salesPesos: s.salesPesos
      })),
      contracts: rawContracts.map((c) => ({
        arrendatarioId: c.arrendatarioId,
        localId: c.localId,
        fechaInicio: c.fechaInicio,
        fechaTermino: c.fechaTermino
      })),
      units: rawUnits.map((u) => ({ id: u.id, glam2: u.glam2, esGLA: u.esGLA })),
      records: rawRecords.map((r) => ({
        unitId: r.unitId,
        period: r.period,
        valueUf: r.valueUf
      })),
      ufByPeriod,
      periods,
      hastaPeriod,
      limit
    });

    const response: TopTenantsResponse = { rows };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
