export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import {
  buildFacturacionTimeSeries,
  type DimensionField,
  type FacturacionRecord
} from "@/lib/finance/facturacion-timeseries";
import {
  buildGlaByDimensionPeriod,
  generatePeriods,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/finance/gla-by-dimension";
import { resolveMonthRange } from "@/lib/finance/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { FacturacionResponse } from "@/types/facturacion";

const VALID_DIMENSIONS: DimensionField[] = ["tamano", "tipo", "piso"];

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

    const rawDimension = searchParams.get("dimension") ?? "tamano";
    const dimension: DimensionField = VALID_DIMENSIONS.includes(rawDimension as DimensionField)
      ? (rawDimension as DimensionField)
      : "tamano";

    const breakdown = searchParams.get("breakdown") === "true";

    const [rawRecords, rawUnits, rawContracts] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          group1: "INGRESOS DE EXPLOTACION"
        },
        select: {
          period: true,
          group3: true,
          valueUf: true,
          sizeCategory: true,
          typeCategory: true,
          floor: true
        }
      }),
      prisma.unit.findMany({
        where: { proyectoId: projectId, estado: "ACTIVO" },
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
        where: { proyectoId: projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
        select: { localId: true, fechaInicio: true, fechaTermino: true }
      })
    ]);

    const units: GlaUnitInput[] = rawUnits.map((u) => ({
      id: u.id,
      tipo: u.tipo,
      esGLA: u.esGLA,
      glam2: u.glam2,
      piso: u.piso,
      zona: u.zona?.nombre ?? null
    }));

    const contracts: GlaContractInput[] = rawContracts.map((c) => ({
      localId: c.localId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino
    }));

    const records: FacturacionRecord[] = rawRecords.map((r) => ({
      period: r.period,
      group3: r.group3,
      valueUf: r.valueUf,
      sizeCategory: r.sizeCategory,
      typeCategory: r.typeCategory,
      floor: r.floor
    }));

    const { occupied, totals: glaTotals } = buildGlaByDimensionPeriod(units, contracts, periods, dimension);

    const result: FacturacionResponse = buildFacturacionTimeSeries(
      records,
      occupied,
      glaTotals,
      periods,
      dimension,
      breakdown
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
