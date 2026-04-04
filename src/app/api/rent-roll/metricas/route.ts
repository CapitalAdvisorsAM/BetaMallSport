export const dynamic = "force-dynamic";

import { EstadoDiaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import {
  buildResumen,
  getMetricasRentRoll
} from "@/lib/rent-roll/metricas";
import { prisma } from "@/lib/prisma";
import { isPeriodoValido } from "@/lib/validators";
import { buildMetricsCacheKey, getOrSetMetricsCache } from "@/lib/metrics-cache";
import type { RentRollMetricasResponse } from "@/types/metricas";

export const runtime = "nodejs";

type EstadoMetricaFiltro = "OCUPADO" | "GRACIA" | "TODOS";

const allowedEstadoFiltros = new Set<EstadoMetricaFiltro>(["OCUPADO", "GRACIA", "TODOS"]);

function toPeriodo(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseEstado(raw: string | null): EstadoMetricaFiltro | null {
  const normalized = (raw ?? "OCUPADO").toUpperCase();
  return allowedEstadoFiltros.has(normalized as EstadoMetricaFiltro)
    ? (normalized as EstadoMetricaFiltro)
    : null;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    const periodo = searchParams.get("periodo") ?? toPeriodo(new Date());
    const estado = parseEstado(searchParams.get("estado"));

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }
    if (!estado) {
      return NextResponse.json(
        { message: "estado debe ser uno de: OCUPADO, GRACIA o TODOS." },
        { status: 400 }
      );
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const cacheKey = buildMetricsCacheKey("rent-roll-metricas", [proyectoId, periodo, estado]);
    const payload = await getOrSetMetricsCache(
      cacheKey,
      proyectoId,
      120_000,
      async (): Promise<RentRollMetricasResponse> => {
        const hoy = new Date();
        const [metricas, localesActivos] = await Promise.all([
          getMetricasRentRoll(proyectoId, periodo),
          prisma.local.findMany({
            where: { proyectoId, estado: "ACTIVO" },
            select: {
              id: true,
              glam2: true,
              esGLA: true
            }
          })
        ]);

        const estadoFiltro: EstadoDiaContrato | undefined = estado === "TODOS" ? undefined : estado;
        const filas = estadoFiltro ? metricas.filter((fila) => fila.estado === estadoFiltro) : metricas;
        const resumen = buildResumen(filas, localesActivos, hoy);

        return {
          proyectoId,
          periodo,
          filas,
          resumen,
          generadoEn: new Date().toISOString()
        };
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
