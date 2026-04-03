import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    const arrendatarioId = searchParams.get("arrendatarioId");
    const periodo = searchParams.get("periodo"); // "YYYY-MM"

    if (!proyectoId || !arrendatarioId || !periodo) {
      throw new ApiError(400, "proyectoId, arrendatarioId y periodo son requeridos.");
    }

    const periodoDate = new Date(`${periodo}-01`);

    const registros = await prisma.registroContable.findMany({
      where: {
        proyectoId,
        arrendatarioId,
        periodo: periodoDate
      },
      select: {
        grupo1: true,
        grupo3: true,
        denominacion: true,
        valorUf: true
      },
      orderBy: [{ grupo1: "asc" }, { grupo3: "asc" }, { denominacion: "asc" }]
    });

    const partidas = registros.map((r) => ({
      grupo1: r.grupo1,
      grupo3: r.grupo3,
      denominacion: r.denominacion,
      valorUf: Number(r.valorUf)
    }));

    const total = partidas.reduce((acc, p) => acc + p.valorUf, 0);

    return NextResponse.json({ partidas, total });
  } catch (error) {
    return handleApiError(error);
  }
}
