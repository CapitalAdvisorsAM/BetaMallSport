import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { ContractFormPayload } from "@/types";

export const runtime = "nodejs";

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const payload = (await request.json()) as ContractFormPayload;
    const contractId = context.params.id;

    const existing = await prisma.contrato.findUnique({
      where: { id: contractId },
      include: { tarifas: true, ggcc: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const edited = await tx.contrato.update({
        where: { id: contractId },
        data: {
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
        const found = await tx.contratoTarifa.findFirst({
          where: {
            contratoId: contractId,
            tipo: tarifa.tipo as TipoTarifaContrato,
            vigenciaDesde: new Date(tarifa.vigenciaDesde)
          }
        });
        if (found) {
          await tx.contratoTarifa.update({
            where: { id: found.id },
            data: {
              valor: new Prisma.Decimal(tarifa.valor),
              vigenciaHasta: toDate(tarifa.vigenciaHasta),
              esDiciembre: tarifa.esDiciembre
            }
          });
        } else {
          await tx.contratoTarifa.create({
            data: {
              contratoId: contractId,
              tipo: tarifa.tipo as TipoTarifaContrato,
              valor: new Prisma.Decimal(tarifa.valor),
              vigenciaDesde: new Date(tarifa.vigenciaDesde),
              vigenciaHasta: toDate(tarifa.vigenciaHasta),
              esDiciembre: tarifa.esDiciembre
            }
          });
        }
      }

      for (const item of payload.ggcc) {
        const ggcc = await tx.contratoGGCC.findFirst({
          where: {
            contratoId: contractId,
            vigenciaDesde: new Date(item.vigenciaDesde)
          }
        });
        if (ggcc) {
          await tx.contratoGGCC.update({
            where: { id: ggcc.id },
            data: {
              tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
              pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
              vigenciaHasta: toDate(item.vigenciaHasta),
              proximoReajuste: toDate(item.proximoReajuste)
            }
          });
        } else {
          await tx.contratoGGCC.create({
            data: {
              contratoId: contractId,
              tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
              pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
              vigenciaDesde: new Date(item.vigenciaDesde),
              vigenciaHasta: toDate(item.vigenciaHasta),
              proximoReajuste: toDate(item.proximoReajuste)
            }
          });
        }
      }

      if (payload.anexo) {
        await tx.contratoAnexo.create({
          data: {
            contratoId: contractId,
            fecha: new Date(payload.anexo.fecha),
            descripcion: payload.anexo.descripcion,
            camposModificados: { origen: "FORM_UPDATE" },
            snapshotAntes: existing,
            snapshotDespues: edited,
            usuarioId: session.user.id
          }
        });
      }

      return edited;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible actualizar el contrato." }, { status: 500 });
  }
}
