export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import {
  buildGlaByDimensionPeriod,
  generatePeriods,
  mapTamanoFromUnit,
  type DimensionField,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/finance/gla-by-dimension";
import { resolveMonthRange } from "@/lib/finance/period-range";
import {
  buildVentasTimeSeries,
  type VentaContractInput,
  type VentaSaleInput,
  type VentaUnitInput
} from "@/lib/finance/ventas-timeseries";
import { mapCategoria } from "@/lib/kpi";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { VentasAnalyticsResponse } from "@/types/ventas-analytics";

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

    const [rawSales, rawUnits, rawContracts] = await Promise.all([
      prisma.tenantSale.findMany({
        where: { projectId, period: { gte: desdeDate, lte: hastaDate } },
        select: { tenantId: true, period: true, salesUf: true }
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
        select: {
          localId: true,
          arrendatarioId: true,
          fechaInicio: true,
          fechaTermino: true
        }
      })
    ]);

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

    const { occupied, totals: glaTotals } = buildGlaByDimensionPeriod(
      glaUnits,
      glaContracts,
      periods,
      dimension
    );

    const sales: VentaSaleInput[] = rawSales.map((s) => ({
      tenantId: s.tenantId,
      period: s.period,
      salesUf: s.salesUf
    }));

    const ventaContracts: VentaContractInput[] = rawContracts.map((c) => ({
      localId: c.localId,
      arrendatarioId: c.arrendatarioId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino
    }));

    const ventaUnits: VentaUnitInput[] = rawUnits.map((u) => {
      let dimensionValue: string | null = null;
      if (dimension === "piso") {
        dimensionValue = u.piso || null;
      } else if (dimension === "tipo") {
        dimensionValue = mapCategoria(u.zona?.nombre) ?? null;
      } else {
        dimensionValue = mapTamanoFromUnit({
          id: u.id, tipo: u.tipo, esGLA: u.esGLA, glam2: u.glam2, piso: u.piso
        });
      }
      return { id: u.id, glam2: u.glam2, dimensionValue };
    });

    const result: VentasAnalyticsResponse = buildVentasTimeSeries(
      sales,
      ventaContracts,
      ventaUnits,
      occupied,
      glaTotals,
      periods
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
