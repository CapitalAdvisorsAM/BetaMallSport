import { NextRequest, NextResponse } from "next/server";
import { buildEerrDetalle } from "@/lib/finanzas/eerr";
import { resolveMonthRange } from "@/lib/finanzas/period-range";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const grupo1 = searchParams.get("grupo1");
    const grupo3 = searchParams.get("grupo3");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    if (!proyectoId || !grupo1 || !grupo3) {
      throw new ApiError(400, "proyectoId, grupo1 y grupo3 son requeridos.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(desde, hasta);

    const registros = await prisma.registroContable.findMany({
      where: {
        proyectoId,
        grupo1,
        grupo3,
        periodo: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: { periodo: "asc" },
      select: {
        periodo: true,
        valorUf: true,
        categoriaTipo: true,
        localId: true,
        local: { select: { codigo: true, nombre: true } },
        arrendatario: { select: { nombreComercial: true } }
      }
    });

    return NextResponse.json(buildEerrDetalle(registros));
  } catch (error) {
    return handleApiError(error);
  }
}
