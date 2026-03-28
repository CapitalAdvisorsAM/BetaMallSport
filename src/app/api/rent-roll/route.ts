import { EstadoContrato, Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { parsePaginationParams } from "@/lib/pagination";
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
    const where: Prisma.ContratoWhereInput = {
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
    };
    const include: Prisma.ContratoInclude = {
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
    };

    const paginationRequested = searchParams.has("limit") || searchParams.has("cursor");
    if (!paginationRequested) {
      const contracts = await prisma.contrato.findMany({
        where,
        include,
        orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }]
      });
      return NextResponse.json(contracts);
    }

    const { limit, cursor } = parsePaginationParams(searchParams);

    const items = await prisma.contrato.findMany({
      where,
      include,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" }
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
