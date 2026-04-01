import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    if (!proyectoId) throw new ApiError(400, "proyectoId requerido.");

    const desdeDate = desde ? new Date(`${desde}-01`) : new Date("2024-01-01");
    const hastaDate = hasta ? new Date(`${hasta}-01`) : new Date();

    // Arrendatarios vigentes del proyecto con sus locales
    const arrendatarios = await prisma.arrendatario.findMany({
      where: { proyectoId, vigente: true },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        nombreComercial: true,
        contratos: {
          where: { estado: { in: ["VIGENTE", "GRACIA"] } },
          select: {
            id: true,
            localId: true,
            local: { select: { id: true, codigo: true, nombre: true } }
          }
        }
      },
      orderBy: { nombreComercial: "asc" }
    });

    const result = [];

    for (const arr of arrendatarios) {
      const localIds = arr.contratos.map((c) => c.localId);
      if (localIds.length === 0) continue;

      // Registros contables de los locales del arrendatario
      const registros = await prisma.registroContable.findMany({
        where: {
          proyectoId,
          localId: { in: localIds },
          periodo: { gte: desdeDate, lte: hastaDate },
          grupo1: "INGRESOS DE EXPLOTACION"
        }
      });

      // Ventas del arrendatario
      const ventas = await prisma.ventaLocal.findMany({
        where: {
          proyectoId,
          localId: { in: localIds },
          periodo: { gte: desde ?? "2024-01", lte: hasta ?? "9999-12" }
        }
      });

      // Calcular totales por periodo
      const periodos = [...new Set(registros.map((r) => r.periodo.toISOString().slice(0, 7)))].sort();
      const facturacionPorPeriodo: Record<string, number> = {};
      const ventasPorPeriodo: Record<string, number> = {};

      for (const reg of registros) {
        const p = reg.periodo.toISOString().slice(0, 7);
        facturacionPorPeriodo[p] = (facturacionPorPeriodo[p] ?? 0) + Number(reg.valorUf);
      }

      for (const venta of ventas) {
        const p = venta.periodo;
        ventasPorPeriodo[p] = (ventasPorPeriodo[p] ?? 0) + Number(venta.ventasUf);
      }

      const totalFacturado = Object.values(facturacionPorPeriodo).reduce((a, b) => a + b, 0);
      const totalVentas = Object.values(ventasPorPeriodo).reduce((a, b) => a + b, 0);
      const costoOcupacion = totalVentas > 0 ? (totalFacturado / totalVentas) * 100 : null;

      result.push({
        id: arr.id,
        rut: arr.rut,
        razonSocial: arr.razonSocial,
        nombreComercial: arr.nombreComercial,
        locales: arr.contratos.map((c) => ({ id: c.localId, codigo: c.local.codigo, nombre: c.local.nombre })),
        periodos,
        facturacionPorPeriodo,
        ventasPorPeriodo,
        totalFacturado,
        totalVentas,
        costoOcupacion
      });
    }

    return NextResponse.json({ arrendatarios: result });
  } catch (error) {
    return handleApiError(error);
  }
}
