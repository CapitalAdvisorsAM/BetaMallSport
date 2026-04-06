export const dynamic = "force-dynamic";

import { ContractDayStatus, Prisma, ContractRateType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { parsePaginationParams } from "@/lib/pagination";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isPeriodoValido } from "@/lib/validators";

export const runtime = "nodejs";

const allowedStates = new Set<ContractDayStatus>(["OCUPADO", "GRACIA", "VACANTE"]);

function toPeriodo(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPeriodoBounds(periodo: string): { start: Date; nextMonthStart: Date } {
  const [yearRaw, monthRaw] = periodo.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

function getEstadoPeriodo(estadosDia: ContractDayStatus[]): ContractDayStatus {
  if (estadosDia.includes("OCUPADO")) {
    return "OCUPADO";
  }
  if (estadosDia.includes("GRACIA")) {
    return "GRACIA";
  }
  return "VACANTE";
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const rawState = searchParams.get("estado");
    const proyectoId = searchParams.get("proyecto");
    const periodo = searchParams.get("periodo") ?? toPeriodo(new Date());

    if (!proyectoId) {
      return NextResponse.json({ message: "proyecto es obligatorio." }, { status: 400 });
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const estado =
      rawState && allowedStates.has(rawState as ContractDayStatus)
        ? (rawState as ContractDayStatus)
        : undefined;
    const { start, nextMonthStart } = getPeriodoBounds(periodo);
    const today = new Date();
    const where: Prisma.ContractWhereInput = {
      proyectoId,
      contratosDia: {
        some: {
          fecha: { gte: start, lt: nextMonthStart },
          ...(estado ? { estadoDia: estado } : {})
        }
      },
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
    const include: Prisma.ContractInclude = {
      local: true,
      arrendatario: true,
      tarifas: {
        where: {
          tipo: ContractRateType.FIJO_UF_M2,
          vigenciaDesde: { lte: today },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
        },
        orderBy: [{ vigenciaDesde: "desc" }],
        take: 1
      },
      contratosDia: {
        where: {
          fecha: { gte: start, lt: nextMonthStart }
        },
        select: {
          estadoDia: true
        }
      }
    };

    const toResponseItem = (contract: {
      estado: string;
      contratosDia: Array<{ estadoDia: ContractDayStatus }>;
    }): Record<string, unknown> => {
      const estadoPeriodo = getEstadoPeriodo(contract.contratosDia.map((item) => item.estadoDia));
      return {
        ...contract,
        estado: estadoPeriodo,
        estadoDocumento: contract.estado
      };
    };

    const paginationRequested = searchParams.has("limit") || searchParams.has("cursor");
    if (!paginationRequested) {
      const contracts = await prisma.contract.findMany({
        where,
        include,
        orderBy: [{ local: { codigo: "asc" } }, { fechaInicio: "desc" }]
      });
      return NextResponse.json(contracts.map(toResponseItem));
    }

    const { limit, cursor } = parsePaginationParams(searchParams);

    const items = await prisma.contract.findMany({
      where,
      include,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" }
    });

    const hasMore = items.length > limit;
    const data = (hasMore ? items.slice(0, limit) : items).map(toResponseItem);
    const nextCursor = hasMore ? ((data[data.length - 1]?.id as string | undefined) ?? null) : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
