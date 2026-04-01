import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { parsePaginationParams } from "@/lib/pagination";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
}

function normalizedLocalIds(payload: { localId: string; localIds: string[] }): string[] {
  const source = payload.localIds.length > 0 ? payload.localIds : [payload.localId];
  return Array.from(new Set(source));
}

async function generateNumeroContrato(proyectoId: string): Promise<string> {
  while (true) {
    const numeroContrato = crypto.randomUUID().slice(0, 8).toUpperCase();
    const existing = await prisma.contrato.findUnique({
      where: {
        proyectoId_numeroContrato: {
          proyectoId,
          numeroContrato
        }
      },
      select: { id: true }
    });

    if (!existing) {
      return numeroContrato;
    }
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const include = {
      local: true,
      locales: {
        include: {
          local: true
        },
        orderBy: { createdAt: "asc" }
      },
      arrendatario: true,
      tarifas: { orderBy: { vigenciaDesde: "desc" } },
      ggcc: { orderBy: { vigenciaDesde: "desc" } },
      anexos: { orderBy: { createdAt: "desc" }, take: 5 }
    } as const;

    const paginationRequested = searchParams.has("limit") || searchParams.has("cursor");
    if (!paginationRequested) {
      const contracts = await prisma.contrato.findMany({
        where: { proyectoId },
        include,
        orderBy: { updatedAt: "desc" }
      });
      return NextResponse.json(contracts);
    }

    const { limit, cursor } = parsePaginationParams(searchParams);

    const items = await prisma.contrato.findMany({
      where: { proyectoId },
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
    const localIds = normalizedLocalIds(payload);
    const numeroContrato = payload.numeroContrato?.trim() || (await generateNumeroContrato(payload.proyectoId));
    if (localIds.length === 0) {
      throw new ApiError(400, "Debes seleccionar al menos un local.");
    }

    const [locals, arrendatario] = await Promise.all([
      prisma.local.findMany({
        where: { id: { in: localIds }, proyectoId: payload.proyectoId },
        select: { id: true }
      }),
      prisma.arrendatario.findFirst({
        where: { id: payload.arrendatarioId, proyectoId: payload.proyectoId },
        select: { id: true }
      })
    ]);
    if (locals.length !== localIds.length) {
      throw new ApiError(400, "Uno o mas locales no pertenecen al proyecto.");
    }
    if (!arrendatario) {
      throw new ApiError(400, "El arrendatario no pertenece al proyecto.");
    }

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contrato.create({
        data: {
          proyectoId: payload.proyectoId,
          localId: localIds[0],
          arrendatarioId: payload.arrendatarioId,
          numeroContrato,
          fechaInicio: new Date(payload.fechaInicio),
          fechaTermino: new Date(payload.fechaTermino),
          fechaEntrega: toDate(payload.fechaEntrega),
          fechaApertura: toDate(payload.fechaApertura),
          estado: payload.estado,
          pctFondoPromocion: toDecimal(payload.pctFondoPromocion),
          codigoCC: payload.codigoCC,
          pdfUrl: payload.pdfUrl,
          notas: payload.notas
        }
      });

      await tx.contratoLocal.createMany({
        data: localIds.map((localId) => ({
          contratoId: created.id,
          localId
        })),
        skipDuplicates: true
      });

      const tarifasPayload = [
        ...payload.tarifas,
        ...payload.rentaVariable.map((item) => ({
          tipo: "PORCENTAJE" as const,
          valor: item.pctRentaVariable,
          vigenciaDesde: item.vigenciaDesde,
          vigenciaHasta: item.vigenciaHasta,
          esDiciembre: false
        }))
      ];
      const tarifasByKey = new Map<string, (typeof tarifasPayload)[number]>();
      for (const tarifa of tarifasPayload) {
        tarifasByKey.set(`${tarifa.tipo}|${tarifa.vigenciaDesde}`, tarifa);
      }

      if (tarifasByKey.size > 0) {
        await tx.contratoTarifa.createMany({
          data: Array.from(tarifasByKey.values()).map((t) => ({
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
            proximoReajuste: toDate(g.proximoReajuste),
            mesesReajuste: g.mesesReajuste ?? null
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

      return {
        ...created,
        localIds
      };
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
