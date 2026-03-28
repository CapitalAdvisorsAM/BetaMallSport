import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { RentRollPreviewPayload, UploadIssue } from "@/types";

export const runtime = "nodejs";

function decimalOrNull(value: string | null): Prisma.Decimal | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  return new Prisma.Decimal(value);
}

function dateOrNull(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  return new Date(value);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = (await request.json()) as { cargaId?: string };
    const cargaId = body.cargaId ?? "";

    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.cargaDatos.findUnique({ where: { id: cargaId } });
    if (!carga || !carga.errorDetalle) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }

    const payload = parseRentRollPreviewPayload(carga.errorDetalle);
    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el preview para esta carga." }, { status: 422 });
    }
    const reportIssues: UploadIssue[] = [];
    let created = 0;
    let updated = 0;

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: { estado: "PROCESANDO", usuarioId: session.user.id }
    });

    const localMap = new Map(
      (
        await prisma.local.findMany({
          where: { proyectoId: carga.proyectoId },
          select: { id: true, codigo: true }
        })
      ).map((item) => [item.codigo.toUpperCase(), item.id])
    );
    const arrendatarioMap = new Map(
      (
        await prisma.arrendatario.findMany({
          where: { proyectoId: carga.proyectoId },
          select: { id: true, rut: true }
        })
      ).map((item) => [item.rut.toUpperCase(), item.id])
    );

    const duplicatedTarifaKey = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const row of payload.rows) {
        const localId = localMap.get(row.localCodigo.toUpperCase());
        const arrendatarioId = arrendatarioMap.get(row.arrendatarioRut.toUpperCase());

        if (!localId || !arrendatarioId) {
          reportIssues.push({
            rowNumber: row.rowNumber,
            message: "No existe localCodigo o arrendatarioRut en el proyecto seleccionado."
          });
          continue;
        }

        const before = await tx.contrato.findUnique({
          where: {
            proyectoId_numeroContrato: {
              proyectoId: carga.proyectoId,
              numeroContrato: row.numeroContrato
            }
          },
          include: { tarifas: true, ggcc: true }
        });

        const contrato = await tx.contrato.upsert({
          where: {
            proyectoId_numeroContrato: {
              proyectoId: carga.proyectoId,
              numeroContrato: row.numeroContrato
            }
          },
          create: {
            proyectoId: carga.proyectoId,
            localId,
            arrendatarioId,
            numeroContrato: row.numeroContrato,
            fechaInicio: new Date(row.fechaInicio),
            fechaTermino: new Date(row.fechaTermino),
            estado: row.estado,
            pctRentaVariable: decimalOrNull(row.pctRentaVariable),
            pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
            codigoCC: row.codigoCC,
            notas: row.notas
          },
          update: {
            localId,
            arrendatarioId,
            fechaInicio: new Date(row.fechaInicio),
            fechaTermino: new Date(row.fechaTermino),
            estado: row.estado,
            pctRentaVariable: decimalOrNull(row.pctRentaVariable),
            pctFondoPromocion: decimalOrNull(row.pctFondoPromocion),
            codigoCC: row.codigoCC,
            notas: row.notas
          }
        });

        if (before) {
          updated += 1;
        } else {
          created += 1;
        }

        const tarifaKey = `${contrato.id}-${row.tarifaTipo}-${row.tarifaVigenciaDesde}`;
        if (duplicatedTarifaKey.has(tarifaKey)) {
          reportIssues.push({
            rowNumber: row.rowNumber,
            message: "Tarifa duplicada en el archivo para tipo + vigenciaDesde."
          });
          continue;
        }
        duplicatedTarifaKey.add(tarifaKey);

        const existingTarifa = await tx.contratoTarifa.findFirst({
          where: {
            contratoId: contrato.id,
            tipo: row.tarifaTipo as TipoTarifaContrato,
            vigenciaDesde: new Date(row.tarifaVigenciaDesde)
          }
        });

        if (existingTarifa) {
          await tx.contratoTarifa.update({
            where: { id: existingTarifa.id },
            data: {
              valor: new Prisma.Decimal(row.tarifaValor),
              vigenciaHasta: dateOrNull(row.tarifaVigenciaHasta)
            }
          });
        } else {
          await tx.contratoTarifa.create({
            data: {
              contratoId: contrato.id,
              tipo: row.tarifaTipo as TipoTarifaContrato,
              valor: new Prisma.Decimal(row.tarifaValor),
              vigenciaDesde: new Date(row.tarifaVigenciaDesde),
              vigenciaHasta: dateOrNull(row.tarifaVigenciaHasta),
              esDiciembre: false
            }
          });
        }

        if (row.ggccTarifaBaseUfM2 && row.ggccPctAdministracion && row.ggccVigenciaDesde) {
          const ggccExists = await tx.contratoGGCC.findFirst({
            where: {
              contratoId: contrato.id,
              vigenciaDesde: new Date(row.ggccVigenciaDesde)
            }
          });
          if (ggccExists) {
            await tx.contratoGGCC.update({
              where: { id: ggccExists.id },
              data: {
                tarifaBaseUfM2: new Prisma.Decimal(row.ggccTarifaBaseUfM2),
                pctAdministracion: new Prisma.Decimal(row.ggccPctAdministracion),
                vigenciaHasta: dateOrNull(row.ggccVigenciaHasta)
              }
            });
          } else {
            await tx.contratoGGCC.create({
              data: {
                contratoId: contrato.id,
                tarifaBaseUfM2: new Prisma.Decimal(row.ggccTarifaBaseUfM2),
                pctAdministracion: new Prisma.Decimal(row.ggccPctAdministracion),
                vigenciaDesde: new Date(row.ggccVigenciaDesde),
                vigenciaHasta: dateOrNull(row.ggccVigenciaHasta)
              }
            });
          }
        }

        if (row.anexoFecha && row.anexoDescripcion) {
          await tx.contratoAnexo.create({
            data: {
              contratoId: contrato.id,
              fecha: new Date(row.anexoFecha),
              descripcion: row.anexoDescripcion,
              camposModificados: {
                origen: "CARGA_RENT_ROLL",
                rowNumber: row.rowNumber
              },
              snapshotAntes: before ? before : {},
              snapshotDespues: contrato,
              usuarioId: session.user.id
            }
          });
        }
      }
    });

    const report = {
      created,
      updated,
      rejected: reportIssues.length,
      rejectedRows: reportIssues
    };

    const finalPayload: RentRollPreviewPayload = {
      ...payload,
      report
    };

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: {
        estado: reportIssues.length > 0 && created + updated === 0 ? "ERROR" : "OK",
        registrosCargados: created + updated,
        errorDetalle: JSON.stringify(finalPayload)
      }
    });

    return NextResponse.json({
      cargaId: carga.id,
      report
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible aplicar la carga." }, { status: 500 });
  }
}
