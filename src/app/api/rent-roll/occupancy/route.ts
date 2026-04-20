export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { generatePeriods, type GlaContractInput, type GlaUnitInput } from "@/lib/finance/gla-by-dimension";
import { buildOccupancyTimeSeries } from "@/lib/finance/occupancy-timeseries";
import { resolveMonthRange } from "@/lib/finance/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { OccupancyTimeSeriesResponse } from "@/types/occupancy";

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

    const [rawUnits, rawContracts] = await Promise.all([
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

    const result: OccupancyTimeSeriesResponse = buildOccupancyTimeSeries(units, contracts, periods);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
