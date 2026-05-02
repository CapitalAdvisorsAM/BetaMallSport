export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceProjectId } from "@/lib/real/api-params";
import {
  buildCostoOcupacionTable,
  type CostoRecordInput,
  type CostoSaleInput,
  type CostoTenantInput
} from "@/lib/real/costo-ocupacion";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { CostoOcupacionResponse, CostoOcupacionTimeseriesResponse } from "@/types/occupancy-cost";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      return NextResponse.json({ message: "projectId requerido." }, { status: 400 });
    }

    const mode = searchParams.get("mode");
    if (mode === "timeseries") {
      return handleTimeseries(searchParams, projectId);
    }

    const period = searchParams.get("period") ?? searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ message: "period requerido (YYYY-MM)." }, { status: 400 });
    }

    const year = period.slice(0, 4);
    const ytdStart = new Date(`${year}-01-01T00:00:00Z`);
    const periodDate = new Date(`${period}-01T00:00:00Z`);
    const periodEnd = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 0));

    const [rawTenants, rawRecords, rawSales, rawUf] = await Promise.all([
      prisma.tenant.findMany({
        where: { projectId: projectId, vigente: true },
        select: {
          id: true,
          nombreComercial: true,
          contratos: {
            where: { estado: { in: ["VIGENTE", "GRACIA"] } },
            select: {
              localId: true,
              local: {
                select: {
                  id: true,
                  codigo: true,
                  nombre: true,
                  glam2: true,
                  esGLA: true,
                  categoriaTamano: true
                }
              }
            }
          }
        }
      }),
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: ytdStart, lte: periodDate },
          scenario: AccountingScenario.REAL
        },
        select: { tenantId: true, unitId: true, period: true, valueUf: true }
      }),
      prisma.tenantSale.findMany({
        where: { projectId, period: { gte: ytdStart, lte: periodDate } },
        select: { tenantId: true, period: true, salesPesos: true }
      }),
      prisma.valorUF.findMany({
        where: { fecha: { gte: ytdStart, lte: periodEnd } },
        select: { fecha: true, valor: true },
        orderBy: { fecha: "asc" }
      })
    ]);

    const tenants: CostoTenantInput[] = rawTenants.map((t) => ({
      id: t.id,
      nombreComercial: t.nombreComercial,
      contratos: t.contratos.map((c) => ({
        localId: c.localId,
        local: {
          id: c.local.id,
          codigo: c.local.codigo,
          nombre: c.local.nombre,
          glam2: c.local.glam2,
          esGLA: c.local.esGLA,
          categoriaTamano: c.local.categoriaTamano
        }
      }))
    }));

    const records: CostoRecordInput[] = rawRecords.map((r) => ({
      tenantId: r.tenantId,
      unitId: r.unitId,
      period: r.period,
      valueUf: r.valueUf
    }));

    const ufByPeriod = new Map<string, number>();
    for (const uf of rawUf) {
      const key = uf.fecha.toISOString().slice(0, 7);
      ufByPeriod.set(key, Number(uf.valor));
    }

    const sales: CostoSaleInput[] = rawSales.map((s) => ({
      tenantId: s.tenantId,
      period: s.period,
      salesUf: (() => {
        const uf = ufByPeriod.get(s.period.toISOString().slice(0, 7));
        return uf && uf > 0 ? Number(s.salesPesos) / uf : 0;
      })()
    }));

    const result: CostoOcupacionResponse = buildCostoOcupacionTable(
      tenants,
      records,
      sales,
      period
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleTimeseries(
  searchParams: URLSearchParams,
  projectId: string
): Promise<NextResponse> {
  const dimension = (searchParams.get("dimension") ?? "tamano") as "tamano" | "piso";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? searchParams.get("period") ?? "";

  if (!/^\d{4}-\d{2}$/.test(fromParam) || !/^\d{4}-\d{2}$/.test(toParam)) {
    return NextResponse.json({ message: "from y to requeridos (YYYY-MM)." }, { status: 400 });
  }

  const fromDate = new Date(`${fromParam}-01T00:00:00Z`);
  const toDate = new Date(`${toParam}-01T00:00:00Z`);

  const [rawRecords, rawSalesDaily, rawUf] = await Promise.all([
    prisma.accountingRecord.findMany({
      where: {
        projectId,
        group1: "INGRESOS DE EXPLOTACION",
        period: { gte: fromDate, lte: toDate },
        scenario: AccountingScenario.REAL
      },
      select: {
        period: true,
        valueUf: true,
        sizeCategory: true,
        floor: true
      }
    }),
    prisma.tenantSaleDaily.findMany({
      where: { projectId, period: { gte: fromDate, lte: toDate } },
      select: { period: true, salesPesos: true, sizeCategory: true, floor: true }
    }),
    prisma.valorUF.findMany({
      where: { fecha: { gte: fromDate, lte: toDate } },
      select: { fecha: true, valor: true }
    })
  ]);

  const ufByPeriod = new Map<string, number>();
  for (const uf of rawUf) {
    const key = uf.fecha.toISOString().slice(0, 7);
    if (!ufByPeriod.has(key)) ufByPeriod.set(key, Number(uf.valor));
  }

  const billingMap = new Map<string, Map<string, number>>();
  for (const r of rawRecords) {
    const dimValue = (dimension === "tamano" ? r.sizeCategory : r.floor) ?? "Sin datos";
    const p = r.period.toISOString().slice(0, 7);
    const dimMap = billingMap.get(dimValue) ?? new Map<string, number>();
    dimMap.set(p, (dimMap.get(p) ?? 0) + Number(r.valueUf));
    billingMap.set(dimValue, dimMap);
  }

  const salesMap = new Map<string, Map<string, number>>();
  for (const s of rawSalesDaily) {
    const dimValue = (dimension === "tamano" ? s.sizeCategory : s.floor) ?? "Sin datos";
    const p = s.period.toISOString().slice(0, 7);
    const uf = ufByPeriod.get(p) ?? 0;
    const salesUf = uf > 0 ? Number(s.salesPesos) / uf : 0;
    const dimMap = salesMap.get(dimValue) ?? new Map<string, number>();
    dimMap.set(p, (dimMap.get(p) ?? 0) + salesUf);
    salesMap.set(dimValue, dimMap);
  }

  const periods: string[] = [];
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    periods.push(cur.toISOString().slice(0, 7));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  const allDims = new Set([...billingMap.keys(), ...salesMap.keys()]);
  allDims.delete("Sin datos");

  const series = [...allDims].map((dim) => ({
    dimension: dim,
    data: periods.map((p) => {
      const billing = billingMap.get(dim)?.get(p) ?? 0;
      const salesVal = salesMap.get(dim)?.get(p) ?? 0;
      if (salesVal <= 0) return null;
      return (billing / salesVal) * 100;
    })
  }));

  const result: CostoOcupacionTimeseriesResponse = { periods, series };
  return NextResponse.json(result);
}
