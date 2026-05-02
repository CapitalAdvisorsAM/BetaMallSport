export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  getFinanceFrom,
  getFinanceMode,
  getFinancePeriod,
  getFinanceProjectId,
  getFinanceTo
} from "@/lib/real/api-params";
import {
  buildGlaByDimensionPeriod,
  generatePeriods,
  mapTamanoFromUnit,
  type DimensionField,
  type GlaContractInput,
  type GlaUnitInput,
  type TenantRubroByUnitId
} from "@/lib/real/gla-by-dimension";
import { mapCategoria } from "@/lib/kpi";
import { resolveMonthRange } from "@/lib/real/period-range";
import {
  buildVentasTimeSeries,
  type VentaContractInput,
  type VentaSaleInput,
  type VentaUnitInput
} from "@/lib/real/ventas-timeseries";
import { buildSalesCrosstab, type CrosstabSaleInput } from "@/lib/real/sales-crosstab";
import { buildSalesKpis } from "@/lib/real/sales-kpis";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type {
  SalesDimension,
  VentasAnalyticsResponse
} from "@/types/sales-analytics";

const VALID_DIMENSIONS: SalesDimension[] = ["tamano", "tipo", "piso", "zona", "rubro"];

type Mode = "timeseries" | "crosstab" | "kpis";

function parseMode(raw: string | null): Mode {
  if (raw === "crosstab" || raw === "kpis") return raw;
  return "timeseries";
}

function parseDimension(raw: string | null, fallback: SalesDimension): SalesDimension {
  if (raw && (VALID_DIMENSIONS as string[]).includes(raw)) return raw as SalesDimension;
  return fallback;
}

function shiftYear(date: Date, deltaYears: number): Date {
  const out = new Date(date);
  out.setUTCFullYear(out.getUTCFullYear() + deltaYears);
  return out;
}

function rubroLabel(category: string | null): string | null {
  if (!category) return null;
  const map: Record<string, string> = {
    ENTERTAINMENT: "Entretenimiento",
    LIFESTYLE: "Lifestyle",
    SERVICES: "Servicios",
    POWERSPORTS: "Powersports",
    OUTDOOR: "Outdoor",
    ACCESSORIES: "Accesorios",
    MULTISPORT: "Multideporte",
    BICYCLES: "Bicicletas",
    GYM: "Gimnasio"
  };
  return map[category] ?? category;
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

    const mode = parseMode(getFinanceMode(searchParams));
    const dimension = parseDimension(searchParams.get("dimension"), "tamano");
    const rowDim = parseDimension(searchParams.get("rowDim"), "tamano");
    const colDim = parseDimension(searchParams.get("colDim"), "piso");
    const explicitPeriod = getFinancePeriod(searchParams);

    const priorDesde = shiftYear(desdeDate, -1);
    const priorHasta = shiftYear(hastaDate, -1);

    const [rawSales, rawPriorSales, rawUnits, rawContracts, rawTenants, rawUf] = await Promise.all([
      prisma.tenantSale.findMany({
        where: { projectId, period: { gte: desdeDate, lte: hastaDate } },
        select: { tenantId: true, period: true, salesPesos: true }
      }),
      prisma.tenantSale.findMany({
        where: { projectId, period: { gte: priorDesde, lte: priorHasta } },
        select: { tenantId: true, period: true, salesPesos: true }
      }),
      prisma.unit.findMany({
        where: { projectId: projectId, estado: "ACTIVO" },
        select: {
          id: true,
          glam2: true,
          piso: true,
          tipo: true,
          esGLA: true,
          categoriaTamano: true,
          zona: { select: { nombre: true } }
        }
      }),
      prisma.contract.findMany({
        where: { projectId: projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
        select: {
          localId: true,
          arrendatarioId: true,
          fechaInicio: true,
          fechaTermino: true
        }
      }),
      prisma.tenant.findMany({
        where: { projectId },
        select: { id: true, category: true }
      }),
      prisma.valorUF.findMany({
        where: { fecha: { gte: priorDesde, lte: hastaDate } },
        select: { fecha: true, valor: true },
        orderBy: { fecha: "asc" }
      })
    ]);

    const ufByPeriod = new Map<string, number>();
    for (const uf of rawUf) {
      const key = uf.fecha.toISOString().slice(0, 7);
      ufByPeriod.set(key, Number(uf.valor));
    }

    const rubroByTenantId = new Map<string, string | null>();
    for (const t of rawTenants) {
      rubroByTenantId.set(t.id, rubroLabel(t.category));
    }
    const tenantRubroByUnitId: TenantRubroByUnitId = new Map();
    for (const c of rawContracts) {
      tenantRubroByUnitId.set(c.localId, rubroByTenantId.get(c.arrendatarioId) ?? null);
    }

    const glaUnits: GlaUnitInput[] = rawUnits.map((u) => ({
      id: u.id,
      tipo: u.tipo,
      esGLA: u.esGLA,
      glam2: u.glam2,
      piso: u.piso,
      categoriaTamano: u.categoriaTamano,
      zona: u.zona?.nombre ?? null
    }));

    const glaContracts: GlaContractInput[] = rawContracts.map((c) => ({
      localId: c.localId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino
    }));

    const ventaContracts: VentaContractInput[] = rawContracts.map((c) => ({
      localId: c.localId,
      arrendatarioId: c.arrendatarioId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino
    }));

    const sales: VentaSaleInput[] = rawSales.map((s) => ({
      tenantId: s.tenantId,
      period: s.period,
      salesPesos: s.salesPesos
    }));
    const priorSales: VentaSaleInput[] = rawPriorSales.map((s) => ({
      tenantId: s.tenantId,
      period: s.period,
      salesPesos: s.salesPesos
    }));

    if (mode === "kpis") {
      const { occupied } = buildGlaByDimensionPeriod(glaUnits, glaContracts, periods, "tamano");
      const ventaUnitsFlat: VentaUnitInput[] = rawUnits.map((u) => ({
        id: u.id,
        glam2: u.glam2,
        dimensionValue: "_unused_"
      }));
      const result = buildSalesKpis({
        sales,
        priorSales,
        contracts: ventaContracts,
        units: ventaUnitsFlat,
        periods,
        glaOccupied: occupied,
        ufByPeriod
      });
      const response: VentasAnalyticsResponse = result;
      return NextResponse.json(response);
    }

    if (mode === "crosstab") {
      const crosstabPeriods =
        explicitPeriod && /^\d{4}-\d{2}$/.test(explicitPeriod)
          ? [explicitPeriod]
          : periods;

      const crosstabSales: CrosstabSaleInput[] = rawSales.map((s) => ({
        tenantId: s.tenantId,
        period: s.period,
        salesPesos: s.salesPesos
      }));
      const crosstabPrior: CrosstabSaleInput[] = rawPriorSales.map((s) => ({
        tenantId: s.tenantId,
        period: s.period,
        salesPesos: s.salesPesos
      }));

      const result = buildSalesCrosstab({
        sales: crosstabSales,
        priorSales: crosstabPrior,
        contracts: ventaContracts,
        units: rawUnits.map((u) => ({
          id: u.id,
          tipo: u.tipo,
          esGLA: u.esGLA,
          glam2: u.glam2,
          piso: u.piso,
          categoriaTamano: u.categoriaTamano,
          zona: u.zona?.nombre ?? null
        })),
        periods: crosstabPeriods,
        rowDim,
        colDim,
        ufByPeriod,
        tenantRubroByUnitId
      });
      const response: VentasAnalyticsResponse = result;
      return NextResponse.json(response);
    }

    // Default: timeseries
    const dimensionField: DimensionField = dimension;
    const { occupied, totals: glaTotals } = buildGlaByDimensionPeriod(
      glaUnits,
      glaContracts,
      periods,
      dimensionField,
      tenantRubroByUnitId
    );

    const ventaUnits: VentaUnitInput[] = rawUnits.map((u) => {
      let dimensionValue: string | null = null;
      if (dimension === "piso") {
        dimensionValue = u.piso || null;
      } else if (dimension === "tipo") {
        dimensionValue = mapCategoria(u.zona?.nombre) ?? null;
      } else if (dimension === "zona") {
        dimensionValue = u.zona?.nombre?.trim() || null;
      } else if (dimension === "rubro") {
        dimensionValue = tenantRubroByUnitId.get(u.id) ?? null;
      } else {
        dimensionValue = mapTamanoFromUnit({
          id: u.id,
          tipo: u.tipo,
          esGLA: u.esGLA,
          glam2: u.glam2,
          piso: u.piso,
          categoriaTamano: u.categoriaTamano
        });
      }
      return { id: u.id, glam2: u.glam2, dimensionValue };
    });

    const tsResult = buildVentasTimeSeries(
      sales,
      ventaContracts,
      ventaUnits,
      occupied,
      glaTotals,
      periods,
      ufByPeriod,
      priorSales
    );

    const response: VentasAnalyticsResponse = tsResult;
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
