import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
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
    const parsed = contractPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message, issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const payload = parsed.data;

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

      if (payload.tarifas.length > 0) {
        await tx.contratoTarifa.createMany({
          data: payload.tarifas.map((t) => ({
            contratoId: created.id,
            tipo: t.tipo as TipoTarifaContrato,
            valor: new Prisma.Decimal(t.valor),
            vigenciaDesde: new Date(t.vigenciaDesde),
            vigenciaHasta: toDate(t.vigenciaHasta),
            esDiciembre: t.esDiciembre
          }))
        });
      }

      if (payload.ggcc.length > 0) {
        await tx.contratoGGCC.createMany({
          data: payload.ggcc.map((g) => ({
            contratoId: created.id,
            tarifaBaseUfM2: new Prisma.Decimal(g.tarifaBaseUfM2),
            pctAdministracion: new Prisma.Decimal(g.pctAdministracion),
            vigenciaDesde: new Date(g.vigenciaDesde),
            vigenciaHasta: toDate(g.vigenciaHasta),
            proximoReajuste: toDate(g.proximoReajuste)
          }))
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
