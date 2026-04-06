export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildEerrData } from "@/lib/finanzas/eerr";
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

    const registros = await prisma.registroContable.findMany({
      where: {
        proyectoId,
        periodo: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: { periodo: "asc" },
      select: {
        grupo1: true,
        grupo3: true,
        periodo: true,
        valorUf: true
      }
    });

    return NextResponse.json(buildEerrData(registros));
  } catch (error) {
    return handleApiError(error);
  }
}
