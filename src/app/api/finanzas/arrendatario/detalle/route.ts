import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { resolveMonthRange } from "@/lib/finanzas/period-range";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const arrendatarioId = searchParams.get("arrendatarioId");

    // Soporta periodo puntual (YYYY-MM) o rango (desde/hasta)
    const periodo = searchParams.get("periodo");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    if (!proyectoId || !arrendatarioId) {
      throw new ApiError(400, "proyectoId y arrendatarioId son requeridos.");
    }

    let periodoFilter: { periodo: Date } | { periodo: { gte: Date; lte: Date } };
    if (periodo) {
      periodoFilter = { periodo: new Date(`${periodo}-01`) };
    } else {
      const { desdeDate, hastaDate } = resolveMonthRange(desde, hasta);
      periodoFilter = { periodo: { gte: desdeDate, lte: hastaDate } };
    }

    const registros = await prisma.registroContable.findMany({
      where: { proyectoId, arrendatarioId, ...periodoFilter },
      select: { grupo1: true, grupo3: true, denominacion: true, valorUf: true, periodo: true },
      orderBy: [{ grupo1: "asc" }, { grupo3: "asc" }, { periodo: "asc" }]
    });

    // Agrupar por grupo3 con valores por periodo
    const periodos = [...new Set(registros.map((r) => r.periodo.toISOString().slice(0, 7)))].sort();
    const lineMap = new Map<string, { grupo1: string; grupo3: string; porPeriodo: Record<string, number>; total: number }>();

    for (const r of registros) {
      const key = `${r.grupo1}||${r.grupo3}`;
      const p = r.periodo.toISOString().slice(0, 7);
      const v = Number(r.valorUf);
      if (!lineMap.has(key)) {
        lineMap.set(key, { grupo1: r.grupo1, grupo3: r.grupo3, porPeriodo: {}, total: 0 });
      }
      const line = lineMap.get(key)!;
      line.porPeriodo[p] = (line.porPeriodo[p] ?? 0) + v;
      line.total += v;
    }

    const lineas = [...lineMap.values()];
    const total = lineas.reduce((acc, l) => acc + l.total, 0);

    return NextResponse.json({ periodos, lineas, total });
  } catch (error) {
    return handleApiError(error);
  }
}
