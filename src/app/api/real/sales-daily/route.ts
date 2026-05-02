export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getFinanceProjectId } from "@/lib/real/api-params";
import {
  buildGlaByDimensionPeriod,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/real/gla-by-dimension";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildVentasDiarias,
  type VentaDiariaInput
} from "@/lib/real/ventas-diarias";
import type { VentasDiariasResponse } from "@/types/sales-daily";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      return NextResponse.json({ message: "projectId requerido." }, { status: 400 });
    }

    const period = searchParams.get("period") ?? currentPeriod();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ message: "period invalido (YYYY-MM)." }, { status: 400 });
    }

    const [py, pm] = period.split("-").map(Number) as [number, number];
    const monthStart = new Date(Date.UTC(py, pm - 1, 1));
    const monthEnd = new Date(Date.UTC(py, pm, 0));

    const [rawRows, rawUf, rawUnits, rawContracts] = await Promise.all([
      prisma.tenantSaleDaily.findMany({
        where: { projectId, date: { gte: monthStart, lte: monthEnd } },
        select: {
          date: true,
          salesPesos: true,
          sizeCategory: true,
          typeCategory: true,
          floor: true,
          glaType: true,
          storeName: true
        }
      }),
      prisma.valorUF.findMany({
        where: { fecha: { gte: monthStart, lte: monthEnd } },
        select: { fecha: true, valor: true },
        orderBy: { fecha: "asc" }
      }),
      prisma.unit.findMany({
        where: { projectId, estado: "ACTIVO" },
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
        where: { projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
        select: { localId: true, fechaInicio: true, fechaTermino: true }
      })
    ]);

    // UF rate by day-of-month (with carry-forward fallback)
    const ufByDay = new Map<number, number>();
    let lastSeen: number | null = null;
    for (let day = 1; day <= monthEnd.getUTCDate(); day++) {
      const match = rawUf.find((u) => new Date(u.fecha).getUTCDate() === day);
      if (match) {
        lastSeen = Number(match.valor);
        ufByDay.set(day, lastSeen);
      } else if (lastSeen !== null) {
        ufByDay.set(day, lastSeen);
      }
    }
    // Backfill leading days with the first available UF in the month
    const firstAvailable = rawUf[0] ? Number(rawUf[0].valor) : null;
    if (firstAvailable !== null) {
      for (let day = 1; day <= monthEnd.getUTCDate(); day++) {
        if (!ufByDay.has(day)) ufByDay.set(day, firstAvailable);
      }
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

    const tamanoBuckets = buildGlaByDimensionPeriod(glaUnits, glaContracts, [period], "tamano");
    const tipoBuckets = buildGlaByDimensionPeriod(glaUnits, glaContracts, [period], "tipo");
    const pisoBuckets = buildGlaByDimensionPeriod(glaUnits, glaContracts, [period], "piso");

    const totalGla = [...tamanoBuckets.totals.values()].reduce((s, v) => s + v, 0);

    const rows: VentaDiariaInput[] = rawRows.map((r) => ({
      date: r.date,
      salesPesos: r.salesPesos,
      sizeCategory: r.sizeCategory,
      typeCategory: r.typeCategory,
      floor: r.floor,
      glaType: r.glaType,
      storeName: r.storeName
    }));

    const result = buildVentasDiarias(rows, period, ufByDay, {
      total: totalGla,
      byTamano: tamanoBuckets.totals,
      byTipo: tipoBuckets.totals,
      byPiso: pisoBuckets.totals
    });

    const response: VentasDiariasResponse = result;
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
