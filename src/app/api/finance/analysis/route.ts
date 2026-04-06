import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { resolveMonthRange } from "@/lib/finance/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type AnalysisRow = {
  id: string;
  name: string;
  subtitle?: string;
  byPeriod: Record<string, number>;
  total: number;
};

export type AnalysisResponse = {
  periods: string[];
  rows: AnalysisRow[];
  totalsByPeriod: Record<string, number>;
  grandTotal: number;
  availableGroup3: string[];
};

// Legacy aliases during deprecation window.
export type AnalisisFila = {
  id: string;
  nombre: string;
  sub?: string;
  porPeriodo: Record<string, number>;
  total: number;
};

export type AnalisisResponse = {
  periodos: string[];
  filas: AnalisisFila[];
  totalesPorPeriodo: Record<string, number>;
  totalGeneral: number;
  grupo3Disponibles: string[];
};

type DimensionType = "tenant" | "unit" | "category" | "section" | "floor";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);
    const dimensionRaw = (searchParams.get("dimension") ?? "tenant").toLowerCase();
    const order = (searchParams.get("order") ?? searchParams.get("orden") ?? "total_desc").toLowerCase();
    const group3Param = searchParams.get("group3") ?? searchParams.get("grupo3s");

    const dimension: DimensionType =
      dimensionRaw === "arrendatario"
        ? "tenant"
        : dimensionRaw === "local"
          ? "unit"
          : dimensionRaw === "categoria"
            ? "category"
            : dimensionRaw === "seccion"
              ? "section"
              : dimensionRaw === "piso"
                ? "floor"
                : dimensionRaw === "tenant" ||
                    dimensionRaw === "unit" ||
                    dimensionRaw === "category" ||
                    dimensionRaw === "section" ||
                    dimensionRaw === "floor"
                  ? (dimensionRaw as DimensionType)
                  : "tenant";

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);
    const group3Filter = group3Param
      ? group3Param
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : null;

    const records = await prisma.accountingRecord.findMany({
      where: {
        projectId,
        period: { gte: desdeDate, lte: hastaDate },
        ...(group3Filter ? { group3: { in: group3Filter } } : {})
      },
      select: {
        group1: true,
        group3: true,
        period: true,
        valueUf: true,
        tenantId: true,
        unitId: true,
        tenant: { select: { nombreComercial: true, razonSocial: true } },
        unit: { select: { codigo: true, nombre: true, piso: true } }
      },
      orderBy: { period: "asc" }
    });

    const availableGroup3 = await prisma.accountingRecord
      .findMany({
        where: { projectId, period: { gte: desdeDate, lte: hastaDate } },
        select: { group3: true },
        distinct: ["group3"]
      })
      .then((rows) => [...new Set(rows.map((row) => row.group3))].sort());

    const periods = [...new Set(records.map((record) => record.period.toISOString().slice(0, 7)))].sort();

    const rowMap = new Map<string, AnalysisRow>();

    for (const record of records) {
      const period = record.period.toISOString().slice(0, 7);
      const value = Number(record.valueUf);

      let key: string;
      let name: string;
      let subtitle: string | undefined;

      switch (dimension) {
        case "tenant":
          if (!record.tenantId || !record.tenant) continue;
          key = record.tenantId;
          name = record.tenant.nombreComercial || record.tenant.razonSocial;
          break;
        case "unit":
          if (!record.unitId || !record.unit) continue;
          key = record.unitId;
          name = `[${record.unit.codigo}] ${record.unit.nombre}`;
          subtitle = record.unit.piso ?? undefined;
          break;
        case "category":
          key = record.group3;
          name = record.group3;
          subtitle = record.group1;
          break;
        case "section":
          key = record.group1;
          name = record.group1;
          break;
        case "floor":
          if (!record.unit) continue;
          key = record.unit.piso ?? "Sin piso";
          name = record.unit.piso ?? "Sin piso";
          break;
      }

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          id: key,
          name,
          subtitle,
          byPeriod: {},
          total: 0
        });
      }

      const row = rowMap.get(key)!;
      row.byPeriod[period] = (row.byPeriod[period] ?? 0) + value;
      row.total += value;
    }

    const rows = [...rowMap.values()];
    if (order === "name" || order === "nombre") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === "total_asc") {
      rows.sort((a, b) => a.total - b.total);
    } else {
      rows.sort((a, b) => b.total - a.total);
    }

    const totalsByPeriod: Record<string, number> = {};
    for (const row of rows) {
      for (const [period, value] of Object.entries(row.byPeriod)) {
        totalsByPeriod[period] = (totalsByPeriod[period] ?? 0) + value;
      }
    }

    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

    const response = {
      periods,
      rows,
      totalsByPeriod,
      grandTotal,
      availableGroup3,
      periodos: periods,
      filas: rows.map((row) => ({
        id: row.id,
        nombre: row.name,
        sub: row.subtitle,
        porPeriodo: row.byPeriod,
        total: row.total
      })),
      totalesPorPeriodo: totalsByPeriod,
      totalGeneral: grandTotal,
      grupo3Disponibles: availableGroup3
    };

    return NextResponse.json(response satisfies AnalysisResponse & AnalisisResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
