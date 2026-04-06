import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { resolveMonthRange } from "@/lib/finanzas/period-range";
import { prisma } from "@/lib/prisma";

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

type DimensionType = "arrendatario" | "local" | "categoria" | "seccion" | "piso";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const dimension = (searchParams.get("dimension") ?? "arrendatario") as DimensionType;
    const grupo3sParam = searchParams.get("grupo3s"); // comma-separated, empty = all
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    const orden = searchParams.get("orden") ?? "total_desc"; // nombre|total_desc|total_asc

    if (!proyectoId) throw new ApiError(400, "proyectoId requerido.");

    const { desdeDate, hastaDate } = resolveMonthRange(desde, hasta);
    const grupo3Filter = grupo3sParam ? grupo3sParam.split(",").filter(Boolean) : null;

    const registros = await prisma.registroContable.findMany({
      where: {
        proyectoId,
        periodo: { gte: desdeDate, lte: hastaDate },
        ...(grupo3Filter ? { grupo3: { in: grupo3Filter } } : {})
      },
      select: {
        grupo1: true,
        grupo3: true,
        periodo: true,
        valorUf: true,
        arrendatarioId: true,
        localId: true,
        arrendatario: { select: { nombreComercial: true, razonSocial: true } },
        local: { select: { codigo: true, nombre: true, piso: true } }
      },
      orderBy: { periodo: "asc" }
    });

    // Distinct grupo3 available (without filter applied)
    const grupo3Disponibles = await prisma.registroContable
      .findMany({
        where: { proyectoId, periodo: { gte: desdeDate, lte: hastaDate } },
        select: { grupo3: true },
        distinct: ["grupo3"]
      })
      .then((rows) => [...new Set(rows.map((r) => r.grupo3))].sort());

    const periodos = [
      ...new Set(registros.map((r) => r.periodo.toISOString().slice(0, 7)))
    ].sort();

    type AggRow = { id: string; nombre: string; sub?: string; porPeriodo: Record<string, number>; total: number };
    const rowMap = new Map<string, AggRow>();

    for (const r of registros) {
      const p = r.periodo.toISOString().slice(0, 7);
      const v = Number(r.valorUf);

      let key: string;
      let nombre: string;
      let sub: string | undefined;

      switch (dimension) {
        case "arrendatario":
          if (!r.arrendatarioId || !r.arrendatario) continue;
          key = r.arrendatarioId;
          nombre = r.arrendatario.nombreComercial || r.arrendatario.razonSocial;
          break;
        case "local":
          if (!r.localId || !r.local) continue;
          key = r.localId;
          nombre = `[${r.local.codigo}] ${r.local.nombre}`;
          sub = r.local.piso ?? undefined;
          break;
        case "categoria":
          key = r.grupo3;
          nombre = r.grupo3;
          sub = r.grupo1;
          break;
        case "seccion":
          key = r.grupo1;
          nombre = r.grupo1;
          break;
        case "piso":
          if (!r.localId || !r.local) continue;
          key = r.local.piso ?? "Sin piso";
          nombre = r.local.piso ?? "Sin piso";
          break;
        default:
          continue;
      }

      if (!rowMap.has(key)) rowMap.set(key, { id: key, nombre, sub, porPeriodo: {}, total: 0 });
      const row = rowMap.get(key)!;
      row.porPeriodo[p] = (row.porPeriodo[p] ?? 0) + v;
      row.total += v;
    }

    let filas = [...rowMap.values()];

    // Sort
    if (orden === "nombre") {
      filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (orden === "total_asc") {
      filas.sort((a, b) => a.total - b.total);
    } else {
      filas.sort((a, b) => b.total - a.total);
    }

    // Column totals
    const totalesPorPeriodo: Record<string, number> = {};
    for (const f of filas) {
      for (const [p, v] of Object.entries(f.porPeriodo)) {
        totalesPorPeriodo[p] = (totalesPorPeriodo[p] ?? 0) + v;
      }
    }
    const totalGeneral = filas.reduce((s, f) => s + f.total, 0);

    return NextResponse.json({ periodos, filas, totalesPorPeriodo, totalGeneral, grupo3Disponibles } satisfies AnalisisResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
