export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import {
  buildGlaByDimensionPeriod,
  generatePeriods,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/real/gla-by-dimension";
import {
  buildGgccDeficit,
  type GgccRecordInput
} from "@/lib/real/ggcc-deficit";
import { resolveMonthRange } from "@/lib/real/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { GgccDeficitResponse } from "@/types/ggcc-deficit";

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

    const [rawRecords, rawIncomeRecords, rawUnits, rawContracts] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          group1: "VACANCIA G.C. + CONTRIBUCIONES"
        },
        select: {
          period: true,
          group1: true,
          group3: true,
          valueUf: true,
          sizeCategory: true
        }
      }),
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          group1: "INGRESOS DE EXPLOTACION"
        },
        select: {
          period: true,
          group1: true,
          group3: true,
          valueUf: true,
          sizeCategory: true
        }
      }),
      prisma.unit.findMany({
        where: { projectId: projectId, estado: "ACTIVO" },
        select: {
          id: true,
          glam2: true,
          piso: true,
          tipo: true,
          esGLA: true,
          zona: { select: { nombre: true } }
        }
      }),
      prisma.contract.findMany({
        where: { projectId: projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
        select: { localId: true, fechaInicio: true, fechaTermino: true }
      })
    ]);

    // Combine cost records + recovery records from income
    const recoveryFromIncome = rawIncomeRecords.filter((r) =>
      r.group3.toUpperCase().includes("RECUPERACION GASTOS COMUNES")
    );

    const allRecords: GgccRecordInput[] = [
      ...rawRecords.map((r) => ({
        period: r.period,
        group1: r.group1,
        group3: r.group3,
        valueUf: r.valueUf,
        sizeCategory: r.sizeCategory
      })),
      ...recoveryFromIncome.map((r) => ({
        period: r.period,
        group1: r.group1,
        group3: r.group3,
        valueUf: r.valueUf,
        sizeCategory: r.sizeCategory
      }))
    ];

    const incomeRecords: GgccRecordInput[] = rawIncomeRecords.map((r) => ({
      period: r.period,
      group1: r.group1,
      group3: r.group3,
      valueUf: r.valueUf,
      sizeCategory: r.sizeCategory
    }));

    // Compute total GLA per period for UF/m2 calculations
    const glaUnits: GlaUnitInput[] = rawUnits.map((u) => ({
      id: u.id,
      tipo: u.tipo,
      esGLA: u.esGLA,
      glam2: u.glam2,
      piso: u.piso,
      zona: u.zona?.nombre ?? null
    }));

    const glaContracts: GlaContractInput[] = rawContracts.map((c) => ({
      localId: c.localId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino
    }));

    const { occupied } = buildGlaByDimensionPeriod(glaUnits, glaContracts, periods, "tamano");

    // Total occupied GLA per period (sum across all dimensions)
    const totalGlaByPeriod = new Map<string, number>();
    for (const period of periods) {
      let total = 0;
      for (const [, periodMap] of occupied) {
        total += periodMap.get(period) ?? 0;
      }
      totalGlaByPeriod.set(period, total);
    }

    const result: GgccDeficitResponse = buildGgccDeficit(
      allRecords,
      incomeRecords,
      totalGlaByPeriod,
      periods
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
