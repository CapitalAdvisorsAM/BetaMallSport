import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStates = new Set<EstadoContrato>([
  "VIGENTE",
  "TERMINADO",
  "TERMINADO_ANTICIPADO",
  "GRACIA"
]);

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const rawState = searchParams.get("estado");
  const estado =
    rawState && allowedStates.has(rawState as EstadoContrato)
      ? (rawState as EstadoContrato)
      : undefined;
  const today = new Date();

  const contracts = await prisma.contrato.findMany({
    where: {
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

  return NextResponse.json(
    contracts.map((contract) => ({
      id: contract.id,
      numeroContrato: contract.numeroContrato,
      estado: contract.estado,
      fechaInicio: contract.fechaInicio,
      fechaTermino: contract.fechaTermino,
      local: {
        codigo: contract.local.codigo,
        nombre: contract.local.nombre,
        glam2: contract.local.glam2
      },
      arrendatario: {
        nombreComercial: contract.arrendatario.nombreComercial
      },
      tarifaVigenteUfM2: contract.tarifas[0]?.valor ?? null
    }))
  );
}
