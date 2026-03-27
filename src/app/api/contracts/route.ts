import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { ContractFormPayload } from "@/types";

export const runtime = "nodejs";

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
}

function validatePayload(payload: ContractFormPayload): string | null {
  if (!payload.proyectoId || !payload.localId || !payload.arrendatarioId || !payload.numeroContrato) {
    return "Faltan campos obligatorios del contrato.";
  }
  if (new Date(payload.fechaInicio) > new Date(payload.fechaTermino)) {
    return "fechaInicio no puede ser mayor que fechaTermino.";
  }
  const keys = new Set<string>();
  for (const tarifa of payload.tarifas) {
    const key = `${tarifa.tipo}-${tarifa.vigenciaDesde}`;
    if (keys.has(key)) {
      return "Hay tarifas duplicadas con mismo tipo + vigenciaDesde.";
    }
    keys.add(key);
  }
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const contracts = await prisma.contrato.findMany({
      where: { proyectoId },
      include: {
        local: true,
        arrendatario: true,
        tarifas: { orderBy: { vigenciaDesde: "desc" } },
        ggcc: { orderBy: { vigenciaDesde: "desc" } },
        anexos: { orderBy: { createdAt: "desc" }, take: 5 }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(contracts);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible listar contratos." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const payload = (await request.json()) as ContractFormPayload;
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contrato.create({
        data: {
          proyectoId: payload.proyectoId,
          localId: payload.localId,
          arrendatarioId: payload.arrendatarioId,
          numeroContrato: payload.numeroContrato,
          fechaInicio: new Date(payload.fechaInicio),
          fechaTermino: new Date(payload.fechaTermino),
          fechaEntrega: toDate(payload.fechaEntrega),
          fechaApertura: toDate(payload.fechaApertura),
          estado: payload.estado,
          pctRentaVariable: toDecimal(payload.pctRentaVariable),
          pctFondoPromocion: toDecimal(payload.pctFondoPromocion),
          codigoCC: payload.codigoCC,
          pdfUrl: payload.pdfUrl,
          notas: payload.notas
        }
      });

      for (const tarifa of payload.tarifas) {
        await tx.contratoTarifa.create({
          data: {
            contratoId: created.id,
            tipo: tarifa.tipo as TipoTarifaContrato,
            valor: new Prisma.Decimal(tarifa.valor),
            vigenciaDesde: new Date(tarifa.vigenciaDesde),
            vigenciaHasta: toDate(tarifa.vigenciaHasta),
            esDiciembre: tarifa.esDiciembre
          }
        });
      }

      for (const item of payload.ggcc) {
        await tx.contratoGGCC.create({
          data: {
            contratoId: created.id,
            tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
            pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
            vigenciaDesde: new Date(item.vigenciaDesde),
            vigenciaHasta: toDate(item.vigenciaHasta),
            proximoReajuste: toDate(item.proximoReajuste)
          }
        });
      }

      if (payload.anexo) {
        await tx.contratoAnexo.create({
          data: {
            contratoId: created.id,
            fecha: new Date(payload.anexo.fecha),
            descripcion: payload.anexo.descripcion,
            camposModificados: { origen: "FORM_CREATE" },
            snapshotAntes: {},
            snapshotDespues: created,
            usuarioId: session.user.id
          }
        });
      }

      return created;
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible crear el contrato." }, { status: 500 });
  }
}
