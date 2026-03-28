import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { buildMetricaRow, buildResumen, type ContratoConRelaciones } from "@/lib/rent-roll/metricas";
import { prisma } from "@/lib/prisma";
import { isPeriodoValido } from "@/lib/validators";
import type { RentRollMetricasResponse, RentRollMetricaRow } from "@/types/metricas";

export const runtime = "nodejs";

type EstadoMetricaFiltro = "VIGENTE" | "GRACIA" | "TODOS";

const allowedEstadoFiltros = new Set<EstadoMetricaFiltro>(["VIGENTE", "GRACIA", "TODOS"]);

function toPeriodo(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseEstado(raw: string | null): EstadoMetricaFiltro | null {
  const normalized = (raw ?? "VIGENTE").toUpperCase() as EstadoMetricaFiltro;
  return allowedEstadoFiltros.has(normalized) ? normalized : null;
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
        { message: "estado debe ser uno de: VIGENTE, GRACIA o TODOS." },
        { status: 400 }
      );
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const hoy = new Date();
    const estadoFiltro: EstadoContrato | undefined = estado === "TODOS" ? undefined : estado;

    const [contratos, localesActivos, ventasPeriodo] = await Promise.all([
      prisma.contrato.findMany({
        where: {
          proyectoId,
          ...(estadoFiltro ? { estado: estadoFiltro } : {})
        },
        include: {
          local: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              glam2: true,
              esGLA: true,
              estado: true
            }
          },
          arrendatario: {
            select: {
              nombreComercial: true
            }
          },
          tarifas: {
            where: {
              tipo: TipoTarifaContrato.FIJO_UF_M2,
              vigenciaDesde: { lte: hoy },
              OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }]
            },
            orderBy: { vigenciaDesde: "desc" },
            take: 1
          },
          ggcc: {
            where: {
              vigenciaDesde: { lte: hoy }
            },
            orderBy: { vigenciaDesde: "desc" },
            take: 1
          }
        },
        orderBy: [{ local: { codigo: "asc" } }]
      }),
      prisma.local.findMany({
        where: { proyectoId, estado: "ACTIVO" },
        select: {
          id: true,
          glam2: true,
          esGLA: true
        }
      }),
      prisma.ventaLocal.findMany({
        where: { proyectoId, periodo },
        select: {
          localId: true,
          ventasUf: true
        }
      })
    ]);

    const ventasMap = new Map<string, number>(
      ventasPeriodo.map((venta) => [venta.localId, venta.ventasUf.toNumber()])
    );
    const filas: RentRollMetricaRow[] = contratos.map((contrato) =>
      buildMetricaRow(contrato as ContratoConRelaciones, ventasMap, periodo)
    );
    const resumen = buildResumen(filas, localesActivos, hoy);

    const payload: RentRollMetricasResponse = {
      proyectoId,
      periodo,
      filas,
      resumen,
      generadoEn: new Date().toISOString()
    };

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
