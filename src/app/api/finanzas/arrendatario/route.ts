export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildTenantFinanceRows } from "@/lib/finanzas/arrendatarios";
import { resolveMonthRange } from "@/lib/finanzas/period-range";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    if (!proyectoId) {
      throw new ApiError(400, "proyectoId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(desde, hasta);

    const arrendatarios = await prisma.tenant.findMany({
      where: { proyectoId, vigente: true },
      orderBy: { nombreComercial: "asc" },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        nombreComercial: true,
        contratos: {
          where: { estado: { in: ["VIGENTE", "GRACIA"] } },
          select: {
            localId: true,
            local: {
              select: {
                id: true,
                codigo: true,
                nombre: true
              }
            }
          }
        }
      }
    });

    const localIds = [...new Set(arrendatarios.flatMap((item) => item.contratos.map((contract) => contract.localId)))];
    if (localIds.length === 0) {
      return NextResponse.json({ arrendatarios: [] });
    }

    const [registros, ventas] = await Promise.all([
      prisma.registroContable.findMany({
        where: {
          proyectoId,
          localId: { in: localIds },
          periodo: { gte: desdeDate, lte: hastaDate },
          grupo1: "INGRESOS DE EXPLOTACION"
        },
        select: {
          localId: true,
          periodo: true,
          valorUf: true
        }
      }),
      prisma.ventaLocal.findMany({
        where: {
          proyectoId,
          localId: { in: localIds },
          periodo: { gte: desde ?? "2024-01", lte: hasta ?? "9999-12" }
        },
        select: {
          localId: true,
          periodo: true,
          ventasUf: true
        }
      })
    ]);

    return NextResponse.json({
      arrendatarios: buildTenantFinanceRows(arrendatarios, registros, ventas)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
