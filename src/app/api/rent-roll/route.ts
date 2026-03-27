import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStates = new Set<EstadoContrato>([
  "VIGENTE",
  "TERMINADO",
  "TERMINADO_ANTICIPADO",
  "GRACIA"
]);

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const rawState = searchParams.get("estado");
    const proyectoId = searchParams.get("proyecto");

    if (!proyectoId) {
      return NextResponse.json({ message: "proyecto es obligatorio." }, { status: 400 });
    }

    const estado =
      rawState && allowedStates.has(rawState as EstadoContrato)
        ? (rawState as EstadoContrato)
        : undefined;
    const today = new Date();

    const contracts = await prisma.contrato.findMany({
      where: {
        proyectoId,
        ...(estado ? { estado } : {}),
        ...(q
          ? {
              OR: [
                { numeroContrato: { contains: q, mode: "insensitive" } },
                { local: { codigo: { contains: q, mode: "insensitive" } } },
                { local: { nombre: { contains: q, mode: "insensitive" } } },
                { arrendatario: { nombreComercial: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {})
      },
      include: {
        local: true,
        arrendatario: true,
        tarifas: {
          where: {
            tipo: TipoTarifaContrato.FIJO_UF_M2,
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          take: 1
        }
      },
      orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }]
    });

    return NextResponse.json(contracts);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible obtener el rent roll." }, { status: 500 });
  }
}
